package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Adición de un contrato.
 *
 * La adición vive en {@code contratacion.ct_t_contrato_infoadicional} (una fila por contrato) y
 * las fechas de vigencia del contrato en {@code contratacion.ct_t_contrato_sap}. Ninguna de las dos
 * está en el CDC, así que se leen bajo demanda cuando se abre el detalle de un contrato.
 */
@Repository
public class AdicionJdbcRepository {

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * La adición registrada para el contrato, con su valor, lo facturado de esa adición,
     * el plazo que quedó y la vigencia del contrato.
     */
    public record Adicion(String noContrato, boolean tieneAdicion, BigDecimal valorAdicion,
                          BigDecimal facturadoAdicion, BigDecimal saldoAdicion, String plazoEjecucionFinal,
                          Integer cantidadProroga, Integer duracionDias, String fechaInicio, String fechaFin,
                          String fechaActualizacion) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public AdicionJdbcRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Adicion adicion(String noContrato) {
        List<Adicion> lista = jdbc.query(
                "SELECT a.no_contrato, a.adicion, a.valor_adicion, a.facturado_adicion,"
                        + "       a.plazo_ejecucion_final, a.cantidad_proroga, a.fecha_actualizacion,"
                        + "       s.fecha_inicio, s.fecha_fin "
                        + "  FROM contratacion.ct_t_contrato_infoadicional a "
                        + "  LEFT JOIN contratacion.ct_t_contrato_sap s ON s.no_contrato = a.no_contrato "
                        + " WHERE a.no_contrato = :noContrato",
                new MapSqlParameterSource("noContrato", noContrato),
                (rs, numero) -> {
                    BigDecimal valor = rs.getBigDecimal("valor_adicion");
                    BigDecimal facturado = rs.getBigDecimal("facturado_adicion");
                    String inicio = rs.getString("fecha_inicio");
                    String fin = rs.getString("fecha_fin");
                    return new Adicion(
                            rs.getString("no_contrato"),
                            esSi(rs.getString("adicion")),
                            valor,
                            facturado,
                            valor == null ? null : valor.subtract(facturado == null ? BigDecimal.ZERO : facturado),
                            rs.getString("plazo_ejecucion_final"),
                            valorInteger(rs, "cantidad_proroga"),
                            duracionDias(inicio, fin),
                            inicio,
                            fin,
                            rs.getString("fecha_actualizacion"));
                });
        return lista.isEmpty() ? null : lista.get(0);
    }

    private static boolean esSi(String valor) {
        return valor != null && "SI".equalsIgnoreCase(valor.trim());
    }

    private static Integer valorInteger(ResultSet rs, String columna) throws SQLException {
        int valor = rs.getInt(columna);
        return rs.wasNull() ? null : valor;
    }

    /** Días entre el inicio y el fin del contrato; null si alguna de las dos fechas no es válida. */
    private static Integer duracionDias(String inicio, String fin) {
        LocalDate desde = parsear(inicio);
        LocalDate hasta = parsear(fin);
        if (desde == null || hasta == null || hasta.isBefore(desde)) {
            return null;
        }
        return (int) ChronoUnit.DAYS.between(desde, hasta);
    }

    /** Las fechas del SAP son texto {@code yyyy-MM-dd}; algunas traen un sufijo que se descarta. */
    private static LocalDate parsear(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String texto = valor.trim();
        if (texto.length() > 10) {
            texto = texto.substring(0, 10);
        }
        try {
            return LocalDate.parse(texto, FECHA);
        } catch (Exception ignorada) {
            return null;
        }
    }
}
