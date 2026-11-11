package com.sgcc.seguimientocuentas.accesos.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * El pool de conexiones a la base GECOR.
 *
 * A proposito NO se registra como un bean de tipo DataSource: Spring Boot arma un solo origen de
 * datos (el de supervisa) y si apareciera un segundo bean DataSource dejaria de crear el suyo.
 * Por eso el pool vive aqui, encapsulado, y se usa solo por JDBC.
 */
@Component
public class GecorDatabase {

    private static final Logger log = LoggerFactory.getLogger(GecorDatabase.class);

    private final GecorProperties properties;
    private volatile HikariDataSource pool;
    private volatile JdbcTemplate jdbc;

    public GecorDatabase(GecorProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void abrir() {
        if (!properties.configurada()) {
            log.info("Base GECOR apagada: el acceso queda abierto para todos los usuarios autenticados");
            return;
        }
        HikariConfig config = new HikariConfig();
        config.setPoolName("gecor-pool");
        config.setJdbcUrl(properties.getUrl());
        config.setUsername(properties.getUsername());
        config.setPassword(properties.getPassword());
        config.setMaximumPoolSize(Math.max(1, properties.getPoolSize()));
        config.setConnectionTimeout(10_000);
        config.setInitializationFailTimeout(-1);
        pool = new HikariDataSource(config);
        jdbc = new JdbcTemplate(pool);
        log.info("Base GECOR lista: {}", properties.getUrl());
    }

    @PreDestroy
    public void cerrar() {
        if (pool != null) {
            pool.close();
        }
    }

    public boolean disponible() {
        return jdbc != null;
    }

    /** El pool, para Flyway. Se entrega el objeto, no se registra como bean DataSource. */
    public DataSource dataSource() {
        return pool;
    }

    /** @return el JDBC de GECOR, o null si la base esta apagada o no se pudo abrir. */
    public JdbcTemplate jdbc() {
        return jdbc;
    }
}
