package com.sgcc.seguimientocuentas.cdc.adapter.in;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgcc.seguimientocuentas.cdc.application.CdcEventService;
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

import java.util.Properties;

/**
 * CDCListener - El "oido" del sistema en la base de datos.
 *
 * Este clase es la puerta de entrada de todo el sistema CDC (Change Data Capture).
 * Su trabajo es simple pero critico: conectarse a PostgreSQL y escuchar en tiempo real
 * cada vez que alguien inserta, actualiza o elimina una fila en las tablas monitoreadas.
 *
 * Como funciona internamente:
 * 1. Al arrancar la app (@PostConstruct), arma la configuracion de Debezium con todos
 *    los parametros de conexion (host, puerto, usuario, tablas, etc.)
 * 2. Lanza un hilo daemon separado que ejecuta el motor Debezium. Se usa un hilo
 *    aparte para que si el motor CDC se caiga, la app principal siga funcionando.
 * 3. Debezium se conecta a PostgreSQL usando logical replication (no JDBC comun),
 *    lo que le permite leer el WAL (Write-Ahead Log) sin afectar el rendimiento.
 * 4. Cada vez que detecta un cambio en una fila, invoca el callback handleChangeEvent()
 *    que pasa el evento al CdcEventService para que lo procese.
 * 5. Al apagar la app (@PreDestroy), cierra el motor limpiamente.
 *
 * Requisito: PostgreSQL debe tener wal_level = logical para que esto funcione.
 *
 * Este componente es condicional: si en el properties se pone cdc.enabled=false,
 * esta clase no se crea y el CDC no arranca.
 */
@Component
@ConditionalOnProperty(name = "cdc.enabled", havingValue = "true", matchIfMissing = true)
public class CDCListener {

    private static final Logger log = LoggerFactory.getLogger(CDCListener.class);

    private final ObjectMapper objectMapper;
    private final CdcEventService cdcEventService;

    public CDCListener(ObjectMapper objectMapper, CdcEventService cdcEventService) {
        this.objectMapper = objectMapper;
        this.cdcEventService = cdcEventService;
    }

    // ========================================
    // CONFIGURACION DE DEBEZIUM
    // Todos estos valores vienen del application.properties con el prefijo debezium.*
    // ========================================

    @Value("${debezium.database.hostname}")
    private String hostname;  // Host donde corre PostgreSQL (ej: localhost)

    @Value("${debezium.database.port}")
    private String port;  // Puerto de PostgreSQL (ej: 5432)

    @Value("${debezium.database.user}")
    private String user;  // Usuario de PostgreSQL (necesita permisos de replication)

    @Value("${debezium.database.password}")
    private String password;  // Contrasena del usuario

    @Value("${debezium.database.dbname}")
    private String dbname;  // Nombre de la base de datos a monitorear (ej: supervisa)

    @Value("${debezium.topic.prefix}")
    private String topicPrefix;  // Prefijo para los topics internos de Kafka

    @Value("${debezium.slot.name}")
    private String slotName;  // Nombre del slot de replicacion en PostgreSQL

    @Value("${debezium.plugin.name}")
    private String pluginName;  // Plugin de decodificacion WAL (pgoutput = nativo de PG10+)

    @Value("${debezium.schema.include.list}")
    private String schemaList;  // Esquemas a monitorear (ej: contratistas,contratacion,ras)

    @Value("${debezium.table.include.list}")
    private String tableList;  // Tablas especificas a monitorear (esquema.tabla)

    @Value("${debezium.snapshot.mode}")
    private String snapshotMode;  // Si tomar snapshot inicial (initial) o no (never)

    @Value("${debezium.heartbeat.interval.ms}")
    private String heartbeatInterval;  // Intervalo de heartbeat para mantener viva la conexion

    @Value("${debezium.publication.autocreate.mode}")
    private String publicationAutocreateMode;  // Como crear la publicacion PG (filtered)

    @Value("${debezium.engine.name}")
    private String engineName;  // Nombre identificador del motor CDC

    @Value("${debezium.connector.class}")
    private String connectorClass;  // Clase Java del connector (PostgresConnector)

    @Value("${debezium.bootstrap.servers}")
    private String bootstrapServers;  // Servidores Kafka (para embedded engine)

    @Value("${debezium.offset.storage.file.filename}")
    private String offsetStorageFile;  // Archivo donde se guarda la posicion del WAL procesada

    private DebeziumEngine<ChangeEvent<String, String>> engine;

    /**
     * Metodo que arranca el motor CDC al iniciar la aplicacion.
     *
     * Este metodo se ejecuta automaticamente gracias a @PostConstruct despues de que
     * Spring inyecte todas las dependencias. Aqui es donde "despierta" el sistema CDC.
     *
     * Paso a paso:
     * 1. Arma todas las propiedades de configuracion en un objeto Properties
     * 2. Crea el motor Debezium en formato JSON con esas propiedades
     * 3. Le indica que use handleChangeEvent() como callback para cada cambio
     * 4. Lanza el motor en un hilo daemon (si el hilo muere, la app sigue viva)
     * 5. Registra en el log que CDC esta listo escuchando
     *
     * Si algo falla, la app funciona normalmente pero sin CDC.
     */
    @PostConstruct
    public void start() {
        try {
            // Armar la configuracion del motor Debezium
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

            // Crear el motor Debezium con formato JSON
            // .notifying() registra el metodo que se llamara con cada cambio detectado
            engine = DebeziumEngine.create(Json.class)
                    .using(props)
                    .notifying(this::handleChangeEvent)
                    .build();

            // Lanzar el motor en un hilo daemon separado
            // Daemon = si la app principal se cierra, este hilo se muere automaticamente
            Thread cdcThread = new Thread(() -> {
                try {
                    engine.run();  // Este metodo bloquea y escucha cambios infinitamente
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

    /**
     * Callback que se ejecuta cada vez que Debezium detecta un cambio en la BD.
     *
     * El evento contiene:
     * - destination(): el nombre del "topico" (ej: supervisa.contratistas.ct_t_trazabilidad)
     * - value(): el JSON con el cambio (antes/despues de la fila modificada)
     *
     * Simplemente delega al CdcEventService para que haga el procesamiento.
     */
    private void handleChangeEvent(ChangeEvent<String, String> recordChangeEvent) {
        cdcEventService.procesarEvento(recordChangeEvent.destination(), recordChangeEvent.value());
    }

    /**
     * Metodo que se ejecuta al apagar la aplicacion.
     *
     * Cierra limpiamente el motor Debezium para que:
     * - Libere el slot de replicacion en PostgreSQL
     * - Guarde la posicion actual del WAL en el archivo de offsets
     * - No deje conexiones colgadas
     */
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
