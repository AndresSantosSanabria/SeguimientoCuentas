package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class InformeActividadJdbcRepository {

    private static final RowMapper<InformeActividadRow> INFORME_ROW_MAPPER = (rs, rowNum) ->
            new InformeActividadRow(
                    rs.getLong("id"),
                    rs.getString("no_contrato"),
                    (Integer) rs.getObject("no_informe"),
                    rs.getString("num_informe"),
                    toLocalDate(rs.getDate("fecha_inicio")),
                    toLocalDate(rs.getDate("fecha_fin")),
                    rs.getString("tipo_informe"),
                    rs.getBoolean("requiere_secop"),
                    rs.getBoolean("firmado")
            );

    private final NamedParameterJdbcTemplate jdbc;

    public InformeActividadJdbcRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Integer> contarPorContratos(Collection<String> noContratos) {
        Map<String, Integer> resultado = new HashMap<>();
        if (noContratos == null || noContratos.isEmpty()) {
            return resultado;
        }

        jdbc.query(
                "SELECT no_contrato, count(*) AS total " +
                        "FROM contratistas.ct_t_informe_actividades " +
                        "WHERE no_contrato IN (:contratos) " +
                        "GROUP BY no_contrato",
                Map.of("contratos", noContratos),
                (RowCallbackHandler) rs -> resultado.put(rs.getString("no_contrato"), rs.getInt("total"))
        );

        return resultado;
    }

    public List<InformeActividadRow> listarPorContratos(Collection<String> noContratos) {
        if (noContratos == null || noContratos.isEmpty()) {
            return List.of();
        }

        return jdbc.query(
                "SELECT i.id, i.no_contrato, i.no_informe, i.num_informe, i.fecha_inicio, i.fecha_fin, " +
                        "i.tipo_informe, i.requiere_secop, i.firmado " +
                        "FROM contratistas.ct_t_informe_actividades i " +
                        "WHERE i.no_contrato IN (:contratos) " +
                        "ORDER BY i.no_contrato, i.id",
                Map.of("contratos", noContratos),
                INFORME_ROW_MAPPER
        );
    }

    private static LocalDate toLocalDate(Date date) {
        return date != null ? date.toLocalDate() : null;
    }
}
