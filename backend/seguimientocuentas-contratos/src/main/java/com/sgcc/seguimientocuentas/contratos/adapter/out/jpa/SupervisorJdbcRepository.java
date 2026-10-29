package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;

/**
 * Catálogo de usuarios de la plataforma, usado para ponerle nombre al supervisor de cada contrato.
 */
@Repository
public class SupervisorJdbcRepository {

    private final JdbcTemplate jdbc;

    public SupervisorJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<Long, String> nombresPorId() {
        Map<Long, String> nombres = new HashMap<>();
        jdbc.query(
                "SELECT id, nombre FROM public.t_usuarios WHERE nombre IS NOT NULL",
                (RowCallbackHandler) rs -> nombres.put(rs.getLong("id"), rs.getString("nombre").trim()));
        return nombres;
    }
}
