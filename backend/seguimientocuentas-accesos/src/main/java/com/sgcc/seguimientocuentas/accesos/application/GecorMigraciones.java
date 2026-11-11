package com.sgcc.seguimientocuentas.accesos.application;

import com.sgcc.seguimientocuentas.accesos.config.GecorDatabase;
import com.sgcc.seguimientocuentas.accesos.config.GecorProperties;
import jakarta.annotation.PostConstruct;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Pattern;

/**
 * Deja la base GECOR lista al arrancar: la crea si no existe y le aplica las migraciones.
 *
 * Flyway se maneja a mano y no con la autoconfiguracion de Spring Boot porque GECOR tiene su propio
 * pool, que a proposito no es un bean DataSource: la autoconfiguracion usaria el de supervisa y
 * escribiria su historial de migraciones en una base que solo se lee.
 *
 * Las migraciones viven en db/migration/gecor. La V1 crea el esquema y la V2 siembra el catalogo;
 * lo que un administrador cambie despues no se pisa, porque Flyway no repite lo ya aplicado.
 */
@Component
public class GecorMigraciones {

    private static final Logger log = LoggerFactory.getLogger(GecorMigraciones.class);

    private static final String ESQUEMA = "gecor";
    private static final String UBICACION = "classpath:db/migration/gecor";

    /** El nombre de la base va en el SQL como identificador: solo se acepta si es un nombre simple. */
    private static final Pattern NOMBRE_BASE = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private static final String YA_EXISTE = "42P04";

    private final GecorDatabase database;
    private final GecorProperties properties;

    public GecorMigraciones(GecorDatabase database, GecorProperties properties) {
        this.database = database;
        this.properties = properties;
    }

    @PostConstruct
    public void migrar() {
        if (!properties.configurada()) {
            return;
        }
        try {
            if (properties.isCrearBase()) {
                crearBaseSiFalta();
            }
            MigrateResult resultado = Flyway.configure()
                    .dataSource(database.dataSource())
                    .schemas(ESQUEMA)
                    .locations(UBICACION)
                    .load()
                    .migrate();
            if (resultado.migrationsExecuted == 0) {
                log.info("GECOR al dia: no habia migraciones pendientes");
            } else {
                log.info("GECOR al dia: {} migraciones aplicadas, esquema en version {}",
                        resultado.migrationsExecuted, resultado.targetSchemaVersion);
            }
        } catch (Exception e) {
            // Sin base de permisos no se abre la puerta: el alcance de todos queda vacio.
            log.error("No se pudo preparar la base GECOR: {}", e.getMessage(), e);
        }
    }

    /**
     * Crea la base en el primer despliegue. Se conecta a la base de mantenimiento "postgres" del
     * mismo servidor, porque CREATE DATABASE no se puede ejecutar dentro de la base que se crea.
     */
    private void crearBaseSiFalta() throws SQLException {
        URI destino = URI.create(properties.getUrl().substring("jdbc:".length()));
        String nombre = destino.getPath() == null ? "" : destino.getPath().replaceFirst("^/", "");
        if (destino.getHost() == null || !NOMBRE_BASE.matcher(nombre).matches()) {
            log.warn("No se puede crear la base GECOR automaticamente desde la URL {}", properties.getUrl());
            return;
        }

        int puerto = destino.getPort() == -1 ? 5432 : destino.getPort();
        String mantenimiento = "jdbc:postgresql://" + destino.getHost() + ":" + puerto + "/postgres";

        try (Connection conexion = DriverManager.getConnection(
                mantenimiento, properties.getUsername(), properties.getPassword())) {
            if (existe(conexion, nombre)) {
                return;
            }
            try (Statement sentencia = conexion.createStatement()) {
                sentencia.execute("CREATE DATABASE \"" + nombre + "\"");
            }
            log.info("Base GECOR creada: {}", nombre);
        } catch (SQLException e) {
            // Otra instancia la creo entre la comprobacion y el CREATE: no es un error.
            if (!YA_EXISTE.equals(e.getSQLState())) {
                throw e;
            }
        }
    }

    private static boolean existe(Connection conexion, String nombre) throws SQLException {
        try (PreparedStatement consulta = conexion.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?")) {
            consulta.setString(1, nombre);
            try (ResultSet filas = consulta.executeQuery()) {
                return filas.next();
            }
        }
    }
}