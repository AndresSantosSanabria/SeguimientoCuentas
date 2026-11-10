package com.sgcc.seguimientocuentas.cdc.adapter.in;

import com.sgcc.seguimientocuentas.cdc.application.CdcEventService;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenIndex;
import io.debezium.engine.DebeziumEngine;
import io.debezium.engine.ChangeEvent;
import io.debezium.engine.format.Json;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Properties;

/**
 * El oido del sistema sobre el WAL de PostgreSQL.
 *
 * El motor Debezium corre en su propio hilo daemon y se reinicia con espera creciente cada vez que
 * cae. Antes de volver a escuchar recarga el indice desde la base: lo que paso mientras el motor
 * estuvo fuera ya no lo trae el WAL, y asi el indice no necesita ninguna reconciliacion periodica.
 * Requiere wal_level = logical. Se apaga con cdc.enabled=false.
 */
@Component
@ConditionalOnProperty(name = "cdc.enabled", havingValue = "true", matchIfMissing = true)
public class CDCListener {

    private static final Logger log = LoggerFactory.getLogger(CDCListener.class);

    private static final long ESPERA_BASE_MS = 5_000;
    private static final long ESPERA_MAXIMA_MS = 60_000;
    private static final long CONEXION_ESTABLE_MS = 60_000;

    private final CdcEventService cdcEventService;
    private final ContratoResumenIndex indice;

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

    private volatile DebeziumEngine<ChangeEvent<String, String>> engine;
    private volatile boolean detenido;

    public CDCListener(CdcEventService cdcEventService, ContratoResumenIndex indice) {
        this.cdcEventService = cdcEventService;
        this.indice = indice;
    }

    /**
     * El indice se lleno en su propio @PostConstruct, y Spring lo construye antes que a este bean
     * porque depende de el: el motor nunca alcanza a parchear un indice vacio.
     */
    @PostConstruct
    public void start() {
        reportarCoberturaDeTablas();
        Thread hilo = new Thread(this::escuchar, "contrato-cdc");
        hilo.setDaemon(true);
        hilo.start();
    }

    private void escuchar() {
        long espera = ESPERA_BASE_MS;
        while (!detenido) {
            long inicio = System.currentTimeMillis();
            try {
                engine = construirMotor();
                log.info("Motor CDC en marcha: {}:{} / {}", hostname, port, dbname);
                engine.run();
            } catch (Exception e) {
                log.warn("El motor CDC se detuvo: {}", e.getMessage());
            } finally {
                cerrarMotor();
            }
            if (detenido) {
                return;
            }
            if (System.currentTimeMillis() - inicio > CONEXION_ESTABLE_MS) {
                espera = ESPERA_BASE_MS;
            }
            if (!esperar(espera)) {
                return;
            }
            espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
            recargarIndice();
        }
    }

    private boolean esperar(long millis) {
        try {
            Thread.sleep(millis);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void recargarIndice() {
        try {
            indice.cargar();
            log.info("Indice recargado despues de la caida del CDC; el motor vuelve a escuchar desde el WAL");
        } catch (Exception e) {
            log.warn("No se pudo recargar el indice: {}", e.getMessage());
        }
    }

    private DebeziumEngine<ChangeEvent<String, String>> construirMotor() {
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

        return DebeziumEngine.create(Json.class)
                .using(props)
                .notifying(this::handleChangeEvent)
                .build();
    }

    /**
     * Lo que la proyeccion necesita frente a lo que Debezium trae: si falta una tabla, el indice se
     * desfasaria en silencio, asi que se avisa apenas se enciende el motor.
     */
    private void reportarCoberturaDeTablas() {
        log.info("========================================");
        log.info("CDC LISTENER INICIADO");
        log.info("Tablas monitoreadas: {}", tableList);
        List<String> faltantes = ContratoResumenIndex.tablasRequeridas().stream()
                .filter(tabla -> !tableList.contains(tabla))
                .toList();
        if (faltantes.isEmpty()) {
            log.info("Cobertura completa: las {} tablas que necesita la proyeccion estan en el log",
                    ContratoResumenIndex.tablasRequeridas().size());
        } else {
            log.warn("Faltan en debezium.table.include.list (el indice no se enterara de estos cambios): {}",
                    String.join(", ", faltantes));
            log.warn("Agreguelas tambien a la publicacion: ALTER PUBLICATION dbz_publication ADD TABLE ...");
        }
        log.info("========================================");
    }

    private void handleChangeEvent(ChangeEvent<String, String> recordChangeEvent) {
        cdcEventService.procesarEvento(recordChangeEvent.destination(), recordChangeEvent.value());
    }

    private void cerrarMotor() {
        if (engine != null) {
            try {
                engine.close();
            } catch (Exception e) {
                log.warn("Al cerrar el motor CDC: {}", e.getMessage());
            }
            engine = null;
        }
    }

    @PreDestroy
    public void stop() {
        detenido = true;
        cerrarMotor();
        log.info("CDC Listener detenido");
    }
}
