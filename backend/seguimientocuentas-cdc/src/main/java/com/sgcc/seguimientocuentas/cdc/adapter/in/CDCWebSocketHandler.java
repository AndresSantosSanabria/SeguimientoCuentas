package com.sgcc.seguimientocuentas.cdc.adapter.in;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
 * 4. broadcast() recorre todas las sesiones activas y les envia el mensaje
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
     * Conjunto de sesiones WebSocket activas (clientes conectados).
     * ConcurrentHashMap.newKeySet() = thread-safe, porque los clientes
     * se conectan/desconectan en paralelo.
     */
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    /**
     * Se ejecuta cuando un cliente se conecta al WebSocket.
     * Simplemente lo agrega a la lista de sesiones activas.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("WebSocket CDC conectado - Sesion: {} - Clientes activos: {}",
                session.getId(), sessions.size());
    }

    /**
     * Se ejecuta cuando un cliente se desconecta (cierra el navegador, error de red, etc.).
     * Lo elimina de la lista de sesiones activas.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("WebSocket CDC desconectado - Sesion: {} - Clientes activos: {}",
                session.getId(), sessions.size());
    }

    /**
     * Se ejecuta si ocurre un error en la conexion de un cliente.
     * Lo elimina silenciosamente de la lista.
     */
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("Error en WebSocket CDC - Sesion: {} - Error: {}",
                session.getId(), exception.getMessage());
        sessions.remove(session);
    }

    /**
     * Envia un mensaje JSON a TODOS los clientes conectados por WebSocket.
     *
     * Este es el metodo que CdcEventService llama despues de procesar cada
     * evento CDC. Recorre todas las sesiones activas y les envia el mensaje.
     *
     * Si un cliente no puede recibir el mensaje (sesion cerrada, error, etc.),
     * se elimina silenciosamente sin afectar a los demas clientes.
     *
     * @param json mensaje JSON a enviar (formato de texto)
     */
    public void broadcast(String json) {
        if (sessions.isEmpty()) {
            return;  // No hay clientes conectados, no enviar nada
        }

        TextMessage message = new TextMessage(json);

        // Eliminar sesiones muertas antes de enviar
        sessions.removeIf(session -> !session.isOpen());

        // Enviar a todas las sesiones activas
        for (WebSocketSession session : sessions) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            } catch (IOException e) {
                log.warn("No se pudo enviar mensaje a sesion {}: {}",
                        session.getId(), e.getMessage());
                sessions.remove(session);  // Eliminar sesion con error
            }
        }

        log.debug("Mensaje broadcast a {} clientes: {}",
                sessions.size(), json.length() > 100
                        ? json.substring(0, 100) + "..."
                        : json);
    }

    /**
     * Retorna el numero de clientes conectados actualmente.
     * Util para monitoreo y debugging.
     */
    public int getConnectedClients() {
        return sessions.size();
    }
}
