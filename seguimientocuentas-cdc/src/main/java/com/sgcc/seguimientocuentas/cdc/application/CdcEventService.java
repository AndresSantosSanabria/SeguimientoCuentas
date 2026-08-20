package com.sgcc.seguimientocuentas.cdc.application;

import com.sgcc.seguimientocuentas.cdc.adapter.in.CDCWebSocketHandler;
import com.sgcc.seguimientocuentas.cdc.domain.model.EventoCdc;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CdcEventService - El "cerebro" que interpreta los cambios de la base de datos.
 *
 * Recibe los eventos crudos que captura el CDCListener y los transforma en
 * informacion util: sabe en que paso del proceso esta cada contrato.
 *
 * Analogia simple: CDCListener es el oido que escucha, este servicio es el cerebro
 * que entiende lo que esta pasando.
 *
 * QUE HACE CONCRETAMENTE:
 * - Cuando cambia algo en ct_t_trazabilidad -> actualiza el estado del workflow del contrato
 * - Cuando cambia algo en ct_t_supervision -> registra la ultima supervision y su avance
 * - Cuando cambia algo en ct_t_fondos -> anota que se creo un RAS
 * - Cuando cambia algo en ct_pago -> anota que tiene pago
 *
 * Mantiene un mapa en memoria (estadoContratos) donde la llave es el numero de contrato
 * y el valor es un JSON con todo el estado conocido de ese contrato.
 *
 * IMPORTANTE: Los datos se guardan SOLO en memoria. Si la app se reinicia, se pierde
 * el estado y se reconstruye a medida que llegan nuevos eventos.
 *
 * Flujo de un evento:
 * 1. CDCListener detecta cambio en PostgreSQL
 * 2. Llama a procesarEvento(destination, value)
 * 3. Se ignoran los heartbeats (son solo para mantener viva la conexion)
 * 4. Se parsea el JSON y se extrae el "payload.after" (la fila despues del cambio)
 * 5. Se identifica a que contrato pertenece el cambio
 * 6. Se actualiza el mapa de estado de ese contrato
 * 7. Se imprime en el log el estado actualizado del contrato
 */
@Service
public class CdcEventService {

    private static final Logger log = LoggerFactory.getLogger(CdcEventService.class);

    private final ObjectMapper objectMapper;
    private final CDCWebSocketHandler webSocketHandler;

    /**
     * Mapa que guarda el estado de cada contrato en memoria.
     * Llave: numero de contrato (ej: "CT-2024-001")
     * Valor: JSON con todos los datos conocidos del contrato
     *
     * ConcurrentHashMap = thread-safe, porque los eventos CDC llegan en paralelo.
     */
    private final Map<String, ObjectNode> estadoContratos = new ConcurrentHashMap<>();

    /**
     * Mapa que guarda el estado de cada cuenta de cobro individual.
     * Estructura: contrato -> {id_informe_actividad -> id_estado}
     * Ejemplo: "CT-2024-001" -> {117: 16, 118: 9}
     *          significa que la cuenta 117 esta en estado 16 (pagada)
     *          y la cuenta 118 esta en estado 9 (en proceso)
     */
    private final Map<String, Map<Integer, Integer>> contratosCuentas = new ConcurrentHashMap<>();

    /**
     * Mapa que traduce los IDs de estado del workflow a texto legible.
     * Estos IDs corresponden a la tabla ct_t_trazabilidad.id_estado.
     * Ejemplo: id_estado=1 significa "Supervisor debe revisar informe"
     */
    private final Map<Integer, String> siguientesPasosMap = new HashMap<>();

    public CdcEventService(ObjectMapper objectMapper, CDCWebSocketHandler webSocketHandler) {
        this.objectMapper = objectMapper;
        this.webSocketHandler = webSocketHandler;
        inicializarPasos();
    }

    /**
     * Inicializa el mapa de pasos del workflow.
     *
     * Estos 16 pasos representan el ciclo de vida completo de un contrato
     * en el sistema de seguimiento de cuentas:
     *
     * PASOS 1-3:   Fase de registro y revisión inicial
     * PASOS 4-8:   Fase SECOP (aprobación, registro en SECOP)
     * PASOS 9-12:  Fase de aprobación y RAS
     * PASOS 13-16: Fase de cierre (enlace, abogado, ordenador, aprobación final)
     *
     * IMPORTANTE: El estado 10 es una DEVOLUCION (retroceso al paso anterior)
     */
    private void inicializarPasos() {
        siguientesPasosMap.put(1, "Registrando");
        siguientesPasosMap.put(2, "En revisión");
        siguientesPasosMap.put(3, "Rechazado");
        siguientesPasosMap.put(4, "Aprobado pendiente firma");
        siguientesPasosMap.put(5, "Aprobado pendiente firma y SECOP");
        siguientesPasosMap.put(6, "Pendiente SECOP");
        siguientesPasosMap.put(7, "En revisión SECOP");
        siguientesPasosMap.put(8, "Rechazado SECOP");
        siguientesPasosMap.put(9, "Aprobado");
        siguientesPasosMap.put(10, "Informe devuelto al supervisor");
        siguientesPasosMap.put(11, "Supervisión registrada");
        siguientesPasosMap.put(12, "RAS registrado");
        siguientesPasosMap.put(13, "Informe enviado a enlace");
        siguientesPasosMap.put(14, "Informe enviado a abogado");
        siguientesPasosMap.put(15, "Informe enviado a ordenador del gasto");
        siguientesPasosMap.put(16, "Informe aprobado");
    }

    /**
     * Metodo principal que procesa cada evento CDC que llega de Debezium.
     *
     * @param destination nombre del topico Kafka (contiene el nombre de la tabla)
     * @param value       JSON completo del evento Debezium con el cambio
     *
     * Estructura del JSON que llega:
     * {
     *   "payload": {
     *     "before": { ... datos antes del cambio ... },
     *     "after": { ... datos despues del cambio ... },
     *     "source": { ... origen del cambio ... }
     *   }
     * }
     *
     * Solo nos interesa "after" porque es el estado actual de la fila.
     */
    public void procesarEvento(String destination, String value) {
        try {
            // Los heartbeats son mensajes de Debezium para mantener viva la conexion.
            // No contienen datos reales, asi que los ignoramos.
            if (destination != null && destination.contains("heartbeat")) {
                return;
            }

            if (value != null) {
                // Parsear el JSON del evento
                JsonNode rootNode = objectMapper.readTree(value);
                JsonNode afterNode = rootNode.path("payload").path("after");

                // Solo procesamos si hay datos despues del cambio (no es un DELETE)
                if (!afterNode.isMissingNode() && !afterNode.isNull()) {
                    ObjectNode contenido = afterNode.deepCopy();
                    String tabla = destination != null ? destination : "desconocida";

                    // Identificar a que contrato pertenece este cambio
                    String noContrato = extraerNoContrato(tabla, contenido);

                    // Si se pudo identificar el contrato, actualizar su estado
                    if (noContrato != null && !noContrato.isEmpty()) {
                        actualizarEstado(tabla, contenido, noContrato);
                        log.info("CAMBIO DETECTADO - Contrato: {} - Tabla: {}", noContrato, tabla);
                        mostrarEstadoActual(noContrato);

                        // Enviar el estado actualizado a todos los clientes WebSocket conectados
                        notificarWebSocket(noContrato, tabla);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error procesando evento CDC", e);
        }
    }

    /**
     * Extrae el numero de contrato del contenido del evento segun la tabla.
     *
     * Cada tabla tiene su propia forma de identificar el contrato.
     * El numero de contrato es la "llave" que usamos para rastrear el estado.
     *
     * NOTA: ct_pago retorna null porque esa tabla no tiene campo no_contrato
     * directamente util (el pago se asocia por otro camino).
     *
     * @return el numero de contrato, o null si la tabla no tiene ese campo
     */
    private String extraerNoContrato(String tabla, ObjectNode contenido) {
        if (tabla.contains("ct_t_trazabilidad")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_t_supervision")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_pago")) {
            return null;  // ct_pago no tiene no_contrato util para rastreo
        } else if (tabla.contains("ct_t_fondos")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_t_informe_documento")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_t_informe_actividades")) {
            return contenido.path("no_contrato").asText(null);
        }
        return null;
    }

    /**
     * Actualiza el estado en memoria de un contrato segun que tabla cambio.
     *
     * El mapa estadoContratos funciona como un "cache del ultimo conocimiento".
     * Cada vez que llega un evento de una tabla, se actualiza SOLO la parte
     * correspondiente a esa tabla, conservando lo demas.
     *
     * Ejemplo: si el contrato ABC tiene una supervision Y un RAS,
     * y llega un evento de supervision, se actualiza solo el campo de supervision
     * pero el RAS sigue ahi.
     */
    private void actualizarEstado(String tabla, ObjectNode contenido, String noContrato) {
        // computeIfAbsent: si el contrato no existe en el mapa, crea un JSON vacio
        ObjectNode estado = estadoContratos.computeIfAbsent(noContrato, k -> objectMapper.createObjectNode());

        if (tabla.contains("ct_t_trazabilidad")) {
            // CAMBIO EN EL WORKFLOW DEL CONTRATO
            // ct_t_trazabilidad es la tabla principal que indica en que paso va el contrato
            int idEstado = contenido.path("id_estado").asInt(0);
            int idInformeActividad = contenido.path("id_informe_actividad").asInt(0);
            String fecha = convertirFecha(contenido.path("fecha").asText(""));
            String descripcion = contenido.path("descripcion").asText("");

            estado.put("id_estado", idEstado);
            estado.put("estado", siguientesPasosMap.getOrDefault(idEstado, "Estado " + idEstado));
            estado.put("fecha_estado", fecha);
            estado.put("detalle_estado", descripcion);

            // Detectar si es una DEVOLUCION (estado 10 = Informe devuelto al supervisor)
            boolean esDevolucion = (idEstado == 10);
            estado.put("es_devolucion", esDevolucion);

            // Si es devolucion, guardar el paso anterior para saber a donde retrocedio
            if (esDevolucion) {
                int pasoAnterior = estado.has("id_estado_anterior") ? estado.path("id_estado_anterior").asInt(0) : 0;
                estado.put("paso_anterior", pasoAnterior);
            } else {
                // Guardar el estado actual como "anterior" para posible futura devolucion
                estado.put("id_estado_anterior", idEstado);
            }

            // ACTUALIZAR AVANCE INDIVIDUAL DE LA CUENTA DE COBRO
            if (idInformeActividad > 0) {
                // Guardar el estado de esta cuenta de cobro especifica
                Map<Integer, Integer> cuentas = contratosCuentas.computeIfAbsent(
                    noContrato, k -> new HashMap<>()
                );
                cuentas.put(idInformeActividad, idEstado);

                // Calcular avance individual de esta cuenta
                int avanceIndividual = calcularAvanceIndividual(idEstado);
                estado.put("avance_individual", avanceIndividual);
                estado.put("cuenta_cobro_actual", idInformeActividad);

                log.info("  Avance cuenta #{}: {}%", idInformeActividad, avanceIndividual);
            }

        } else if (tabla.contains("ct_t_supervision")) {
            // CAMBIO EN UNA SUPERVISION
            // Registra cual fue la ultima supervision y su porcentaje de avance
            int noSupervision = contenido.path("no_supervision").asInt(0);
            int porcentaje = contenido.path("porcentaje_avance").asInt(0);
            boolean enFirme = contenido.path("en_firme").asBoolean(false);

            estado.put("ultima_supervision", noSupervision);
            estado.put("porcentaje_avance", porcentaje);
            estado.put("en_firme", enFirme);

        } else if (tabla.contains("ct_t_fondos")) {
            // SE CREO UN RAS (Recurso Administrativo de Socorro)
            estado.put("ras_creado", true);

        } else if (tabla.contains("ct_pago")) {
            // SE REGISTRO UN PAGO
            estado.put("tiene_pago", true);

        } else if (tabla.contains("ct_t_informe_actividades")) {
            // SE REGISTRO O ACTUALIZO UN INFORME DE ACTIVIDADES
            int noInforme = contenido.path("no_informe").asInt(0);
            boolean firmado = contenido.path("firmado").asBoolean(false);
            boolean requiereSecop = contenido.path("requiere_secop").asBoolean(false);

            estado.put("no_informe", noInforme);
            estado.put("informe_firmado", firmado);
            estado.put("requiere_secop", requiereSecop);
        }
    }

    /**
     * Imprime en el log el estado actual completo de un contrato.
     *
     * Despues de cada cambio, mostramos TODO lo que sabemos del contrato:
     * - En que paso del workflow esta
     * - Detalle del paso actual
     * - Fecha del ultimo cambio
     * - Si tiene supervisiones y su avance
     * - Si tiene RAS
     * - Cual es el siguiente paso esperado
     *
     * Esto es util para monitorear en tiempo real el avance de cada contrato
     * mirando los logs de la aplicacion.
     */
    private void mostrarEstadoActual(String noContrato) {
        ObjectNode estado = estadoContratos.get(noContrato);
        if (estado == null) {
            log.info("  Estado: SIN DATOS");
            return;
        }

        log.info("--- ESTADO ACTUAL DEL CONTRATO ---");
        log.info("  Contrato: {}", noContrato);

        if (estado.has("estado")) {
            log.info("  Paso del proceso: {}", estado.path("estado").asText());
        }
        if (estado.has("detalle_estado") && !estado.path("detalle_estado").asText().isEmpty()) {
            log.info("  Detalle: {}", estado.path("detalle_estado").asText());
        }
        if (estado.has("fecha_estado")) {
            log.info("  Fecha: {}", estado.path("fecha_estado").asText());
        }
        if (estado.has("ultima_supervision")) {
            log.info("  Ultima supervision: No. {}", estado.path("ultima_supervision").asInt());
            log.info("  Avance supervision: {}%", estado.path("porcentaje_avance").asInt());
        }
        if (estado.has("ras_creado") && estado.path("ras_creado").asBoolean()) {
            log.info("  RAS: CREADO");
        }

        int idEstado = estado.has("id_estado") ? estado.path("id_estado").asInt(0) : 0;
        String siguiente = siguientesPasosMap.get(idEstado);
        if (siguiente != null) {
            log.info("  Siguiente paso: {}", siguiente);
        }

        // Mostrar avance individual de cuentas de cobro
        Map<Integer, Integer> cuentas = contratosCuentas.get(noContrato);
        if (cuentas != null && !cuentas.isEmpty()) {
            log.info("  --- CUENTAS DE COBRO ---");
            int sumaAvances = 0;
            long cuentasPagadas = 0;
            for (Map.Entry<Integer, Integer> entry : cuentas.entrySet()) {
                int avance = calcularAvanceIndividual(entry.getValue());
                String estadoCuenta = siguientesPasosMap.getOrDefault(entry.getValue(), "Estado " + entry.getValue());
                log.info("  Cuenta #{}: {}% - {}", entry.getKey(), avance, estadoCuenta);
                sumaAvances += avance;
                if (entry.getValue() == 16) {
                    cuentasPagadas++;
                }
            }
            int avanceGeneral = sumaAvances / cuentas.size();
            log.info("  Avance general contrato: {}% ({} de {} cuentas pagadas)",
                    avanceGeneral, cuentasPagadas, cuentas.size());
            log.info("  ------------------------");
        }

        log.info("-----------------------------------");
    }

    /**
     * Convierte una marca de tiempo en microsegundos (formato Debezium)
     * a un formato legible: "2024-01-15 14:30:00"
     *
     * Debezium envia las fechas como microsegundos desde epoch (1970-01-01).
     * Este metodo las convierte al formato humano.
     *
     * @param valor string con los microsegundos o fecha en otro formato
     * @return fecha formateada, o el valor original si no se pudo convertir
     */
    private String convertirFecha(String valor) {
        if (valor == null || valor.isEmpty()) return "";
        try {
            long microsegundos = Long.parseLong(valor);
            long milisegundos = microsegundos / 1000;
            Instant instant = Instant.ofEpochMilli(milisegundos);
            DateTimeFormatter formatter = DateTimeFormatter
                    .ofPattern("yyyy-MM-dd HH:mm:ss")
                    .withZone(ZoneId.systemDefault());
            return formatter.format(instant);
        } catch (NumberFormatException e) {
            return valor;  // Si no es un numero, devolver tal cual
        }
    }

    /**
     * Calcula el porcentaje de avance individual de una cuenta de cobro
     * segun su estado actual en el workflow.
     *
     * FLUJO COMPLETO (16 pasos):
     * Estado 1:  6%  - Registrando
     * Estado 2:  12% - En revision
     * Estado 3:  12% - Rechazado (se queda en el mismo porcentaje)
     * Estado 4:  18% - Aprobado pendiente firma
     * Estado 5:  25% - Aprobado pendiente firma y SECOP
     * Estado 6:  31% - Pendiente SECOP
     * Estado 7:  37% - En revision SECOP
     * Estado 8:  37% - Rechazado SECOP (se queda en el mismo porcentaje)
     * Estado 9:  43% - Aprobado
     * Estado 10: 43% - Informe devuelto al supervisor (retroceso)
     * Estado 11: 56% - Supervision registrada
     * Estado 12: 62% - RAS registrado
     * Estado 13: 75% - Informe enviado a enlace
     * Estado 14: 81% - Informe enviado a abogado
     * Estado 15: 87% - Informe enviado a ordenador del gasto
     * Estado 16: 100% - Informe aprobado (PAGADO)
     *
     * @param idEstado el estado actual de la cuenta de cobro
     * @return porcentaje de avance (0-100)
     */
    private int calcularAvanceIndividual(int idEstado) {
        return switch (idEstado) {
            case 1 -> 6;    // Registrando
            case 2 -> 12;   // En revision
            case 3 -> 12;   // Rechazado (se queda)
            case 4 -> 18;   // Aprobado pendiente firma
            case 5 -> 25;   // Aprobado pendiente firma y SECOP
            case 6 -> 31;   // Pendiente SECOP
            case 7 -> 37;   // En revision SECOP
            case 8 -> 37;   // Rechazado SECOP (se queda)
            case 9 -> 43;   // Aprobado
            case 10 -> 43;  // Informe devuelto (retroceso)
            case 11 -> 56;  // Supervision registrada
            case 12 -> 62;  // RAS registrado
            case 13 -> 75;  // Informe enviado a enlace
            case 14 -> 81;  // Informe enviado a abogado
            case 15 -> 87;  // Informe enviado a ordenador del gasto
            case 16 -> 100; // Informe aprobado (PAGADO)
            default -> 0;   // Estado desconocido
        };
    }

    /**
     * Construye un JSON con el estado actual del contrato y lo envia a todos
     * los clientes conectados via WebSocket.
     *
     * Estructura del JSON enviado:
     * {
     *   "tipo": "CAMBIO_DETECTADO",
     *   "contrato": "CT-2024-001",
     *   "tabla": "supervisa.contratistas.ct_t_trazabilidad",
     *   "estado": { ... todo el estado del contrato ... },
     *   "timestamp": 1705336200000
     * }
     *
     * @param noContrato numero del contrato que cambio
     * @param tabla      nombre de la tabla donde se detecto el cambio
     */
    private void notificarWebSocket(String noContrato, String tabla) {
        try {
            ObjectNode estado = estadoContratos.get(noContrato);
            if (estado == null) {
                return;
            }

            // Construir el JSON de notificacion
            ObjectNode notificacion = objectMapper.createObjectNode();
            notificacion.put("tipo", "CAMBIO_DETECTADO");
            notificacion.put("contrato", noContrato);
            notificacion.put("tabla", tabla);
            notificacion.put("timestamp", System.currentTimeMillis());

            // Copiar el estado actual del contrato
            ObjectNode estadoCopia = estado.deepCopy();
            notificacion.set("estado", estadoCopia);

            // Agregar el siguiente paso si existe
            int idEstado = estado.has("id_estado") ? estado.path("id_estado").asInt(0) : 0;
            String siguiente = siguientesPasosMap.get(idEstado);
            if (siguiente != null) {
                estadoCopia.put("siguiente_paso", siguiente);
            }

            // Agregar lista de cuentas de cobro con su avance individual
            Map<Integer, Integer> cuentas = contratosCuentas.get(noContrato);
            if (cuentas != null && !cuentas.isEmpty()) {
                com.fasterxml.jackson.databind.node.ArrayNode arrayCuentas = objectMapper.createArrayNode();
                for (Map.Entry<Integer, Integer> entry : cuentas.entrySet()) {
                    ObjectNode cuentaJson = objectMapper.createObjectNode();
                    cuentaJson.put("id_informe_actividad", entry.getKey());
                    cuentaJson.put("id_estado", entry.getValue());
                    cuentaJson.put("estado", siguientesPasosMap.getOrDefault(entry.getValue(), "Estado " + entry.getValue()));
                    cuentaJson.put("avance_individual", calcularAvanceIndividual(entry.getValue()));
                    arrayCuentas.add(cuentaJson);
                }
                estadoCopia.set("cuentas_cobro", arrayCuentas);

                // Calcular avance general del contrato (promedio de todas las cuentas)
                int sumaAvances = 0;
                int totalCuentas = cuentas.size();
                for (int estadoCuenta : cuentas.values()) {
                    sumaAvances += calcularAvanceIndividual(estadoCuenta);
                }
                int avanceGeneral = totalCuentas > 0 ? sumaAvances / totalCuentas : 0;
                estadoCopia.put("avance_general_contrato", avanceGeneral);
                estadoCopia.put("total_cuentas_cobro", totalCuentas);

                // Contar cuentas pagadas (estado 16)
                long cuentasPagadas = cuentas.values().stream().filter(e -> e == 16).count();
                estadoCopia.put("cuentas_pagadas", (int) cuentasPagadas);
            }

            // Enviar a todos los clientes WebSocket conectados
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(notificacion);
            webSocketHandler.broadcast(json);

        } catch (Exception e) {
            log.error("Error notificando via WebSocket", e);
        }
    }
}
