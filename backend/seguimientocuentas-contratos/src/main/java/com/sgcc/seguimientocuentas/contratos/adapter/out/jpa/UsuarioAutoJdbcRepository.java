package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.UsuarioAuto;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;

/**
 * Las personas de la plataforma con su rol, indexadas por el id de ct_t_user_auto.
 *
 * La trazabilidad guarda id_ct_t_user_auto, no el id de t_usuarios, y ese id además dice el rol que
 * tenía la persona en ese momento. Sin esta tabla el nombre del movimiento salía del usuario
 * equivocado, porque los dos identificadores no coinciden.
 */
@Repository
public class UsuarioAutoJdbcRepository {

    private final JdbcTemplate jdbc;

    public UsuarioAutoJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Id de ct_t_user_auto -> persona y rol. */
    public Map<Long, UsuarioAuto> porIdAuto() {
        Map<Long, UsuarioAuto> resultado = new HashMap<>();
        jdbc.query(
                "SELECT a.id, u.nombre, r.descripcion " +
                        "FROM contratacion.ct_t_user_auto a " +
                        "JOIN public.t_usuarios u ON u.id = a.id_t_usuarios " +
                        "LEFT JOIN contratacion.ct_p_user_rol r ON r.id = a.id_ct_p_user_rol",
                (RowCallbackHandler) rs -> {
                    String nombre = rs.getString("nombre");
                    if (nombre == null || nombre.isBlank()) {
                        return;
                    }
                    resultado.put(rs.getLong("id"),
                            new UsuarioAuto(nombre.trim(), rs.getString("descripcion")));
                });
        return resultado;
    }
}
