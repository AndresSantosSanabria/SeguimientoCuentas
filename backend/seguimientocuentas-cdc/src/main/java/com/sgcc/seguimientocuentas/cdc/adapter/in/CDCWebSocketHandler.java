package com.sgcc.seguimientocuentas.cdc.adapter.in;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * CDCWebSocketHandler - El "cable" que conecta el CDC con los clientes.
 *
 * Este handler gestiona las conexiones WebSocket de los clientes que quieren
 * recibir eventos CDC en tiempo real. Mantiene un registro de todas las
 * sesiones activas y les envia mensajes cuando hay cambios en la BD.
 *
 * ANALOGIA:
 * CDCListener es el "oido" que escucha la BD
 * CdcEventService es el "cerebro" que entiende los cambios
 * CDCWebSocketHandler es el "altavoz" que le dice a los clientes que paso
 *
 * COMO FUNCIONA INTERNAMENTE:
 * 1. Un cliente se conecta via WebSocket -> se agrega a la lista de sesiones
 * 2. Cuando el cliente se desconecta -> se elimina de la lista
 * 3. CdcEventService llama a broadcast() con el JSON del evento
 * 4. broadcast() encola el mensaje y un hilo propio lo reparte a las sesiones activas
 * 5. Si un cliente no puede recibir el mensaje, se elimina silenciosamente
 *
 * ESTRUCTURA DEL JSON QUE RECIBE EL CLIENTE:
 * {
 *   "tipo": "CAMBIO_DETECTADO",
 *   "contrato": "CT-2024-001",
 *   "tabla": "supervisa.contratistas.ct_t_trazabilidad",
 *   "estado": {
 *     "id_estado": 3,
 *     "estado": "Contratista debe corregir informe",
 *     "fecha_estado": "2024-01-15 14:30:00",
 *     "detalle_estado": "Informe rechazado por Supervisor",
 *     "ultima_supervision": 2,
 *     "porcentaje_avance": 60,
 *     "ras_creado": false,
 *     "siguiente_paso": "Contratista debe corregir informe"
 *   },
 *   "timestamp": 1705336200000
 * }
 *
 * NOTA DE SEGURIDAD:
 * Actualmente permite conexiones desde cualquier origen (*).
 * En produccion se debe configurar con los origenes permitidos.
 */
@Component
public class CDCWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CDCWebSocketHandler.class);

    /**
     * Sesiones activas envueltas en un decorator, para que nunca escriban dos hilos en la misma.
     * La clave es el id de sesion porque el decorator no preserva equals() de la sesion original.
     */
    private final Map<String, WebSocketSession> sesiones = new ConcurrentHashMap<>();

    /** Un cliente que se rezaga no puede bloquear al unico hilo de reparto: cierra y reconecta. */
    private static final int LIMITE_ESPERA_MS = 10_000;
    private static final int LIMITE_BUFFER_BYTES = 256 * 1024;

    /**
     * Un solo hilo reparte en orden; con 6000 clientes el reparto tarda ~1,5 s y no puede bloquear
     * el hilo del evento CDC, que es el que sigue parcheando el indice.
     *
     * Cuando la cola se llena el productor espera en vez de repartir el mismo: si el hilo del CDC
     * escribiera a la vez que el hilo de difusion, Tomcat dejaria la sesion en
     * TEXT_PARTIAL_WRITING y ese cliente no volveria a recibir nada. El retraso se va al WAL,
     * que es el buffer natural del CDC.
     */
    private final ExecutorService difusion = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(256),
            runnable -> {
                Thread hilo = new Thread(runnable, "cdc-ws-difusion");
                hilo.setDaemon(true);
                return hilo;
            },
            (runnable, executor) -> {
                if (executor.isShutdown()) {
                    return;
                }
                try {
                    executor.getQueue().put(runnable);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });

    /**
     * Se ejecuta cuando un cliente se conecta al WebSocket.
     * Simplemente lo agrega a la lista de sesiones activas.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sesiones.put(session.getId(),
                new ConcurrentWebSocketSessionDecorator(session, LIMITE_ESPERA_MS, LIMITE_BUFFER_BYTES));
        log.info("WebSocket CDC conectado - Sesion: {} - Clientes activos: {}",
                session.getId(), sesiones.size());
    }

    /**
     * Se ejecuta cuando un cliente se desconecta (cierra el navegador, error de red, etc.).
     * Lo elimina de la lista de sesiones activas.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sesiones.remove(session.getId());
        log.info("WebSocket CDC desconectado - Sesion: {} - Clientes activos: {}",
                session.getId(), sesiones.size());
    }

    /**
     * Se ejecuta si ocurre un error en la conexion de un cliente.
     * Lo elimina silenciosamente de la lista.
     */
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("Error en WebSocket CDC - Sesion: {} - Error: {}",
                session.getId(), exception.getMessage());
        sesiones.remove(session.getId());
    }

    /**
     * Encola el aviso para TODOS los clientes conectados por WebSocket.
     *
     * Lo llama CdcEventService despues de parchear el indice y vuelve enseguida:
     * el reparto lo hace el hilo de difusion, no el hilo del evento CDC.
     *
     * Si un cliente no puede recibir el mensaje (sesion cerrada, error, etc.),
     * se elimina silenciosamente sin afectar a los demas clientes.
     *
     * @param json mensaje JSON a enviar (formato de texto)
     */
    public void broadcast(String json) {
        if (sesiones.isEmpty()) {
            return;  // No hay clientes conectados, no enviar nada
        }
        difusion.execute(() -> repartir(new TextMessage(json)));
    }

    private void repartir(TextMessage mensaje) {
        for (Map.Entry<String, WebSocketSession> entrada : sesiones.entrySet()) {
            WebSocketSession sesion = entrada.getValue();
            try {
                if (sesion.isOpen()) {
                    sesion.sendMessage(mensaje);
                } else {
                    sesiones.remove(entrada.getKey());
                }
            } catch (Exception e) {
                // Incluye el cierre del decorator por clientes rezagados: se sacan del reparto,
                // el cliente ve un close y el hook de CDC reconecta solo.
                log.warn("Cliente CDC fuera del reparto - Sesion: {} - Error: {}",
                        entrada.getKey(), e.getMessage());
                sesiones.remove(entrada.getKey());
            }
        }
    }

    @PreDestroy
    public void cerrar() {
        difusion.shutdown();
    }

    /**
     * Retorna el numero de clientes conectados actualmente.
     * Util para monitoreo y debugging.
     */
    public int getConnectedClients() {
        return sesiones.size();
    }
}
