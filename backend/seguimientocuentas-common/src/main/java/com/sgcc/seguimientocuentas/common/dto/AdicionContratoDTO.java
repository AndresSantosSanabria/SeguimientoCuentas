package com.sgcc.seguimientocuentas.common.dto;

import java.math.BigDecimal;

/**
 * Adición de un contrato: si la tiene, cuánto vale, cuánto se ha facturado de ella y
 * en qué plazo quedó la ejecución.
 */
public class AdicionContratoDTO {

    private String noContrato;

    /** true cuando Supervisa tiene marcada la adición para este contrato. */
    private boolean tieneAdicion;

    private BigDecimal valorAdicion;
    private BigDecimal facturadoAdicion;
    private BigDecimal saldoAdicion;

    /** Plazo de ejecución final acordado (texto tal como lo registra Supervisa). */
    private String plazoEjecucionFinal;
    private Integer cantidadProroga;

    /** Días entre el inicio y el fin del contrato. */
    private Integer duracionDias;
    private String fechaInicio;
    private String fechaFin;
    private String fechaActualizacion;

    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }

    public boolean isTieneAdicion() { return tieneAdicion; }
    public void setTieneAdicion(boolean tieneAdicion) { this.tieneAdicion = tieneAdicion; }

    public BigDecimal getValorAdicion() { return valorAdicion; }
    public void setValorAdicion(BigDecimal valorAdicion) { this.valorAdicion = valorAdicion; }

    public BigDecimal getFacturadoAdicion() { return facturadoAdicion; }
    public void setFacturadoAdicion(BigDecimal facturadoAdicion) { this.facturadoAdicion = facturadoAdicion; }

    public BigDecimal getSaldoAdicion() { return saldoAdicion; }
    public void setSaldoAdicion(BigDecimal saldoAdicion) { this.saldoAdicion = saldoAdicion; }

    public String getPlazoEjecucionFinal() { return plazoEjecucionFinal; }
    public void setPlazoEjecucionFinal(String plazoEjecucionFinal) { this.plazoEjecucionFinal = plazoEjecucionFinal; }

    public Integer getCantidadProroga() { return cantidadProroga; }
    public void setCantidadProroga(Integer cantidadProroga) { this.cantidadProroga = cantidadProroga; }

    public Integer getDuracionDias() { return duracionDias; }
    public void setDuracionDias(Integer duracionDias) { this.duracionDias = duracionDias; }

    public String getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(String fechaInicio) { this.fechaInicio = fechaInicio; }

    public String getFechaFin() { return fechaFin; }
    public void setFechaFin(String fechaFin) { this.fechaFin = fechaFin; }

    public String getFechaActualizacion() { return fechaActualizacion; }
    public void setFechaActualizacion(String fechaActualizacion) { this.fechaActualizacion = fechaActualizacion; }
}
