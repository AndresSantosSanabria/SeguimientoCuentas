package com.sgcc.seguimientocuentas.common.dto;

/**
 * Calificación del contratista y riesgo de incumplimiento de un contrato.
 * La calificación viene del esquema {@code calificacion} y el riesgo de la última supervisión.
 */
public class CalificacionRiesgoDTO {

    private String noContrato;
    private String contratista;
    private String dependencia;
    private String fechaInicio;

    /** Nivel de la última calificación (A, B, C, D) y su etiqueta (Notable, Confiable, Riesgo, Crítico). */
    private String nivel;
    private String puntajeLabel;

    /** Riesgo de incumplimiento de la última supervisión (Alto, Medio, Bajo, Ninguno). */
    private String riesgo;
    private String explicacion;

    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }

    public String getContratista() { return contratista; }
    public void setContratista(String contratista) { this.contratista = contratista; }

    public String getDependencia() { return dependencia; }
    public void setDependencia(String dependencia) { this.dependencia = dependencia; }

    public String getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(String fechaInicio) { this.fechaInicio = fechaInicio; }

    public String getNivel() { return nivel; }
    public void setNivel(String nivel) { this.nivel = nivel; }

    public String getPuntajeLabel() { return puntajeLabel; }
    public void setPuntajeLabel(String puntajeLabel) { this.puntajeLabel = puntajeLabel; }

    public String getRiesgo() { return riesgo; }
    public void setRiesgo(String riesgo) { this.riesgo = riesgo; }

    public String getExplicacion() { return explicacion; }
    public void setExplicacion(String explicacion) { this.explicacion = explicacion; }
}
