package com.sgcc.gestion.realtime.cdc;

// Debezium
import io.debezium.engine.DebeziumEngine;
import io.debezium.engine.ChangeEvent;
import io.debezium.engine.format.Json;

// Jackson
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

// Jakarta
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

// Entities y Repositories
import com.sgcc.gestion.entities.CtPEstado;
import com.sgcc.gestion.repositories.CtPEstadoRepository;

// Logs y Spring
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(name = "cdc.enabled", havingValue = "true", matchIfMissing = true)
public class CDCListener {

    private static final Logger log = LoggerFactory.getLogger(CDCListener.class);

    private final ObjectMapper objectMapper;
    private final CtPEstadoRepository estadoRepository;

    // Mapa en memoria: ultimo estado conocido por contrato
    private final Map<String, ObjectNode> estadoContratos = new ConcurrentHashMap<>();

    // Mapa de estados desde ct_p_estado
    private final Map<Integer, String> estadosMap = new HashMap<>();

    public CDCListener(ObjectMapper objectMapper, CtPEstadoRepository estadoRepository) {
        this.objectMapper = objectMapper;
        this.estadoRepository = estadoRepository;
    }

    @Value("${debezium.database.hostname}")
    private String hostname;

    @Value("${debezium.database.port}")
    private String port;

    @Value("${debezium.database.user}")
    private String user;

    @Value("${debezium.database.password}")
    private String password;

    @Value("${debezium.database.dbname}")
    private String dbname;

    @Value("${debezium.topic.prefix}")
    private String topicPrefix;

    @Value("${debezium.slot.name}")
    private String slotName;

    @Value("${debezium.plugin.name}")
    private String pluginName;

    @Value("${debezium.schema.include.list}")
    private String schemaList;

    @Value("${debezium.table.include.list}")
    private String tableList;

    @Value("${debezium.snapshot.mode}")
    private String snapshotMode;

    @Value("${debezium.heartbeat.interval.ms}")
    private String heartbeatInterval;

    @Value("${debezium.publication.autocreate.mode}")
    private String publicationAutocreateMode;

    @Value("${debezium.engine.name}")
    private String engineName;

    @Value("${debezium.connector.class}")
    private String connectorClass;

    @Value("${debezium.bootstrap.servers}")
    private String bootstrapServers;

    @Value("${debezium.offset.storage.file.filename}")
    private String offsetStorageFile;

    private DebeziumEngine<ChangeEvent<String, String>> engine;

    @PostConstruct
    public void start() {
        try {
            List<CtPEstado> estados = estadoRepository.findAll();
            for (CtPEstado e : estados) {
                estadosMap.put(e.getId(), e.getDescripcion());
            }
            log.info("Estados cargados desde ct_p_estado: {}", estadosMap.size());

            Properties props = new Properties();
            props.setProperty("name", engineName);
            props.setProperty("connector.class", connectorClass);
            props.setProperty("database.hostname", hostname);
            props.setProperty("bootstrap.servers", bootstrapServers);
            props.setProperty("offset.storage.file.filename", offsetStorageFile);
            props.setProperty("database.port", port);
            props.setProperty("database.user", user);
            props.setProperty("database.password", password);
            props.setProperty("database.dbname", dbname);
            props.setProperty("topic.prefix", topicPrefix);
            props.setProperty("slot.name", slotName);
            props.setProperty("plugin.name", pluginName);
            props.setProperty("schema.include.list", schemaList);
            props.setProperty("table.include.list", tableList);
            props.setProperty("snapshot.mode", snapshotMode);
            props.setProperty("heartbeat.interval.ms", heartbeatInterval);
            props.setProperty("publication.autocreate.mode", publicationAutocreateMode);
            props.setProperty("errors.log.enable", "true");
            props.setProperty("errors.tolerance", "all");

            engine = DebeziumEngine.create(Json.class)
                    .using(props)
                    .notifying(this::handleChangeEvent)
                    .build();

            Thread cdcThread = new Thread(() -> {
                try {
                    engine.run();
                } catch (Exception e) {
                    log.warn("CDC Engine se detuvo (la app sigue funcionando): {}", e.getMessage());
                }
            });
            cdcThread.setDaemon(true);
            cdcThread.start();

            log.info("========================================");
            log.info("CDC LISTENER INICIADO");
            log.info("Host: {}:{}", hostname, port);
            log.info("Database: {}", dbname);
            log.info("Tablas: {}", tableList);
            log.info("========================================");

        } catch (Exception e) {
            log.warn("No se pudo iniciar CDC (la app sigue funcionando): {}", e.getMessage());
        }
    }

    private void handleChangeEvent(ChangeEvent<String, String> recordChangeEvent) {
        try {
            String destination = recordChangeEvent.destination();

            if (destination != null && destination.contains("heartbeat")) {
                return;
            }

            String value = recordChangeEvent.value();

            if (value != null) {
                try {
                    JsonNode rootNode = objectMapper.readTree(value);
                    JsonNode afterNode = rootNode.path("payload").path("after");

                    if (!afterNode.isMissingNode() && !afterNode.isNull()) {
                        ObjectNode contenido = afterNode.deepCopy();
                        String tabla = destination != null ? destination : "desconocida";

                        // Obtener numero de contrato segun la tabla
                        String noContrato = extraerNoContrato(tabla, contenido);

                        if (noContrato != null && !noContrato.isEmpty()) {
                            // Actualizar estado en memoria segun la tabla
                            actualizarEstado(tabla, contenido, noContrato);

                            // Log del cambio
                            log.info("========================================");
                            log.info("CAMBIO DETECTADO - Contrato: {}", noContrato);
                            log.info("Tabla: {}", tabla);
                            log.info("Contenido: {}", contenido.toPrettyString());
                            log.info("========================================");

                            // Mostrar estado actual del contrato
                            mostrarEstadoActual(noContrato);
                        }

                    } else {
                        log.warn("Evento sin bloque 'after' (DELETE)");
                    }
                } catch (Exception e) {
                    log.error("Error parseando JSON del WAL", e);
                }
            }

        } catch (Exception e) {
            log.error("Error procesando evento del WAL", e);
        }
    }

    private String extraerNoContrato(String tabla, ObjectNode contenido) {
        if (tabla.contains("ct_t_trazabilidad")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_t_supervision")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_pago")) {
            // ct_pago no tiene no_contrato, tiene id_ct_t_contrato_sap
            return null;
        } else if (tabla.contains("ct_t_fondos")) {
            return contenido.path("no_contrato").asText(null);
        } else if (tabla.contains("ct_t_informe_documento")) {
            return contenido.path("no_contrato").asText(null);
        }
        return null;
    }

    private void actualizarEstado(String tabla, ObjectNode contenido, String noContrato) {
        // Obtener o crear el estado del contrato
        ObjectNode estado = estadoContratos.computeIfAbsent(noContrato, k -> objectMapper.createObjectNode());

        if (tabla.contains("ct_t_trazabilidad")) {
            // Trazabilidad tiene el id_estado que indica el paso del proceso
            int idEstado = contenido.path("id_estado").asInt(0);
            String fecha = convertirFecha(contenido.path("fecha").asText(""));
            String descripcion = contenido.path("descripcion").asText("");

            estado.put("id_estado", idEstado);
            estado.put("estado", resolverEstado(idEstado));
            estado.put("fecha_estado", fecha);
            estado.put("detalle_estado", descripcion);

        } else if (tabla.contains("ct_t_supervision")) {
            int noSupervision = contenido.path("no_supervision").asInt(0);
            int porcentaje = contenido.path("porcentaje_avance").asInt(0);
            boolean enFirme = contenido.path("en_firme").asBoolean(false);

            estado.put("ultima_supervision", noSupervision);
            estado.put("porcentaje_avance", porcentaje);
            estado.put("en_firme", enFirme);

        } else if (tabla.contains("ct_t_fondos")) {
            boolean tieneRAS = true;
            estado.put("ras_creado", tieneRAS);

        } else if (tabla.contains("ct_pago")) {
            // Se registro un pago
            estado.put("tiene_pago", true);
        }
    }

    private void mostrarEstadoActual(String noContrato) {
        ObjectNode estado = estadoContratos.get(noContrato);
        if (estado == null) {
            log.info("  Estado: SIN DATOS");
            return;
        }

        log.info("--- ESTADO ACTUAL DEL CONTRATO ---");
        log.info("  Contrato: {}", noContrato);

        // Estado del flujo
        if (estado.has("estado")) {
            log.info("  Paso del proceso: {}", estado.path("estado").asText());
        }
        if (estado.has("detalle_estado") && !estado.path("detalle_estado").asText().isEmpty()) {
            log.info("  Detalle: {}", estado.path("detalle_estado").asText());
        }
        if (estado.has("fecha_estado")) {
            log.info("  Fecha: {}", estado.path("fecha_estado").asText());
        }

        // Supervision
        if (estado.has("ultima_supervision")) {
            log.info("  Ultima supervision: No. {}", estado.path("ultima_supervision").asInt());
            log.info("  Avance supervision: {}%", estado.path("porcentaje_avance").asInt());
        }

        // RAS
        if (estado.has("ras_creado") && estado.path("ras_creado").asBoolean()) {
            log.info("  RAS: CREADO");
        }

        // Siguiente paso
        String siguiente = determinarSiguientePaso(estado);
        if (siguiente != null) {
            log.info("  Siguiente paso: {}", siguiente);
        }

        log.info("-----------------------------------");
    }

    private String resolverEstado(int idEstado) {
        return estadosMap.getOrDefault(idEstado, "Estado " + idEstado);
    }

    private String determinarSiguientePaso(ObjectNode estado) {
        int idEstado = estado.has("id_estado") ? estado.path("id_estado").asInt(0) : 0;

        switch (idEstado) {
            case 1: return "Supervisor debe revisar informe";
            case 2: return "Generar aprobación pendiente firma";
            case 3: return "Contratista debe corregir informe";
            case 4: return "Pendiente firma y SECOP";
            case 5: return "Pendiente SECOP";
            case 6: return "Revisión SECOP";
            case 7: return "Aprobar o rechazar SECOP";
            case 8: return "Volver a revisión SECOP";
            case 9: return "Supervisor registra supervisión y crea RAS";
            case 10: return "Volver a revisión del informe";
            case 11: return "Crear RAS y enviar a enlace";
            case 12: return "Enviar informe a enlace";
            case 13: return "Enviar informe a abogado";
            case 14: return "Enviar informe a ordenador del gasto";
            case 15: return "Ordenador del gasto aprueba";
            case 16: return "Proceso completado";
            default: return null;
        }
    }

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
            return valor;
        }
    }

    @PreDestroy
    public void stop() {
        if (engine != null) {
            try {
                engine.close();
                log.info("CDC Listener detenido");
            } catch (Exception e) {
                log.error("Error al detener CDC Listener", e);
            }
        }
    }
}
