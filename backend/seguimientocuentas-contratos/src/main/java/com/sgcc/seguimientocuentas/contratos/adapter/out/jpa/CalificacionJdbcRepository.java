package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * Calificación del servicio y riesgo de incumplimiento de un contrato.
 *
 * La calificación vive en el esquema {@code calificacion} (la última evaluación registrada del
 * contratista) y el riesgo en la supervisión ({@code contratacion.ct_t_supervision}); ninguna de las
 * dos está en el CDC, así que se leen bajo demanda cuando se abre el detalle de un contrato.
 */
@Repository
public class CalificacionJdbcRepository {

    /** La última calificación del contrato: nivel, etiqueta, fecha y qué significa ese nivel. */
    public record Calificacion(String nivel, String puntajeLabel, Integer puntajeMin, Integer puntajeMax,
                               String descripcionNivel, String fecha, String observaciones) {
    }

    /** El riesgo que registró la última supervisión del contrato. */
    public record Riesgo(String riesgo, String explicacion, String incumplimientos, String accidentes,
                         String fecha) {
    }

    /**
     * Una fila por contrato con su calificación y su riesgo: el nivel (y su etiqueta) de la última
     * evaluación del contratista y el riesgo de incumplimiento de la última supervisión.
     */
    public record Fila(String noContrato, String contratista, String dependencia, String fechaInicio,
                       String nivel, String puntajeLabel, String riesgo, String explicacion) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CalificacionJdbcRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Calificacion ultimaCalificacion(String noContrato) {
        List<Calificacion> lista = jdbc.query(
                "SELECT c.nivel, c.puntaje_label, e.puntaje_min, e.puntaje_max, e.puntaje_descripcion, "
                        + "       c.fecha, c.observaciones "
                        + "  FROM calificacion.ct_t_calificacion c "
                        + "  LEFT JOIN calificacion.ct_escala_calificacion e "
                        + "         ON e.id_ct_t_formato_calificacion = c.id_formato AND e.nivel = c.nivel "
                        + " WHERE c.no_contrato = :noContrato "
                        + " ORDER BY c.fecha DESC NULLS LAST, c.id DESC LIMIT 1",
                new MapSqlParameterSource("noContrato", noContrato),
                (rs, numero) -> new Calificacion(
                        rs.getString("nivel"),
                        rs.getString("puntaje_label"),
                        valorInteger(rs, "puntaje_min"),
                        valorInteger(rs, "puntaje_max"),
                        rs.getString("puntaje_descripcion"),
                        rs.getString("fecha"),
                        rs.getString("observaciones")));
        return lista.isEmpty() ? null : lista.get(0);
    }

    public Riesgo ultimoRiesgo(String noContrato) {
        List<Riesgo> lista = jdbc.query(
                "SELECT s.riesgo_incumplimiento, s.explicacion_riesgo, s.incumplimientos_accidentes, "
                        + "       s.accidentes_trabajo, s.fecha_operacion "
                        + "  FROM contratacion.ct_t_supervision s "
                        + " WHERE s.no_contrato = :noContrato "
                        + " ORDER BY s.no_supervision DESC NULLS LAST, s.id DESC LIMIT 1",
                new MapSqlParameterSource("noContrato", noContrato),
                (rs, numero) -> new Riesgo(
                        rs.getString("riesgo_incumplimiento"),
                        rs.getString("explicacion_riesgo"),
                        rs.getString("incumplimientos_accidentes"),
                        rs.getString("accidentes_trabajo"),
                        rs.getString("fecha_operacion")));
        return lista.isEmpty() ? null : lista.get(0);
    }

    private static Integer valorInteger(ResultSet rs, String columna) throws SQLException {
        int valor = rs.getInt(columna);
        return rs.wasNull() ? null : valor;
    }

    /**
     * Calificación y riesgo de todos los contratos en una sola lectura.
     *
     * De cada contrato se toma la última calificación registrada y el riesgo de la última
     * supervisión; el recorte por secretaría lo hace el servicio, porque el nombre de la
     * secretaría se compara sin tildes y eso no lo hace el motor igual que Java.
     */
    public List<Fila> listarCalificacionYRiesgo() {
        return jdbc.query(
                "WITH ultima_calificacion AS ("
                        + "  SELECT DISTINCT ON (no_contrato) no_contrato, nivel, puntaje_label, fecha"
                        + "    FROM calificacion.ct_t_calificacion"
                        + "   WHERE no_contrato IS NOT NULL"
                        + "   ORDER BY no_contrato, fecha DESC NULLS LAST, id DESC"
                        + "), ultimo_riesgo AS ("
                        + "  SELECT DISTINCT ON (no_contrato) no_contrato, riesgo_incumplimiento,"
                        + "         explicacion_riesgo, fecha_operacion"
                        + "    FROM contratacion.ct_t_supervision"
                        + "   WHERE no_contrato IS NOT NULL"
                        + "   ORDER BY no_contrato, no_supervision DESC NULLS LAST, id DESC"
                        + ")"
                        + "SELECT c.no_contrato, c.contratista, c.dependencia, c.fecha_inicio,"
                        + "       uc.nivel, uc.puntaje_label,"
                        + "       ur.riesgo_incumplimiento, ur.explicacion_riesgo"
                        + "  FROM contratacion.ct_t_contrato_sap c"
                        + "  LEFT JOIN ultima_calificacion uc ON uc.no_contrato = c.no_contrato"
                        + "  LEFT JOIN ultimo_riesgo ur ON ur.no_contrato = c.no_contrato"
                        + " WHERE c.no_contrato IS NOT NULL"
                        + "   AND btrim(coalesce(c.contratista, '')) <> ''",
                new MapSqlParameterSource(),
                (rs, numero) -> new Fila(
                        rs.getString("no_contrato"),
                        rs.getString("contratista"),
                        rs.getString("dependencia"),
                        rs.getString("fecha_inicio"),
                        rs.getString("nivel"),
                        rs.getString("puntaje_label"),
                        rs.getString("riesgo_incumplimiento"),
                        rs.getString("explicacion_riesgo")));
    }
}
