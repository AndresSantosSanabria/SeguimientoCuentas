package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * Totales de supervisión por contrato. Se agrega en PostgreSQL para no traer 34.000 entidades al JVM:
 * la última es la de mayor (no_supervision, id), igual que el ORDER BY que antes hacía la BD.
 */
@Repository
public class SupervisionJdbcRepository {

    public record UltimaSupervision(int total, Short porcentajeAvance, Long idSupervisor) {
        public static final UltimaSupervision SIN_SUPERVISION = new UltimaSupervision(0, null, null);
    }

    private final NamedParameterJdbcTemplate jdbc;

    public SupervisionJdbcRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, UltimaSupervision> ultimaPorContratos(Collection<String> noContratos) {
        Map<String, UltimaSupervision> resultado = new HashMap<>();
        if (noContratos == null || noContratos.isEmpty()) {
            return resultado;
        }

        jdbc.query(
                "SELECT s.no_contrato, s.total_supervisiones, s.porcentaje_avance, s.id_supervisor " +
                        "FROM (SELECT no_contrato, " +
                        "             count(*) OVER (PARTITION BY no_contrato) AS total_supervisiones, " +
                        "             ROW_NUMBER() OVER (PARTITION BY no_contrato " +
                        "                 ORDER BY no_supervision DESC NULLS LAST, id DESC) AS rn, " +
                        "             porcentaje_avance, id_supervisor " +
                        "      FROM contratacion.ct_t_supervision " +
                        "      WHERE no_contrato IN (:contratos)) s " +
                        "WHERE s.rn = 1",
                new MapSqlParameterSource("contratos", noContratos),
                (RowCallbackHandler) rs -> resultado.put(rs.getString("no_contrato"),
                        new UltimaSupervision(rs.getInt("total_supervisiones"),
                                valorShort(rs, "porcentaje_avance"), valorLong(rs, "id_supervisor"))));

        return resultado;
    }

    private static Short valorShort(ResultSet rs, String columna) throws SQLException {
        short valor = rs.getShort(columna);
        return rs.wasNull() ? null : valor;
    }

    private static Long valorLong(ResultSet rs, String columna) throws SQLException {
        long valor = rs.getLong(columna);
        return rs.wasNull() ? null : valor;
    }
}
