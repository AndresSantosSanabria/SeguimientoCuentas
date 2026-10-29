package com.sgcc.seguimientocuentas.common.dto;

import java.util.ArrayList;
import java.util.List;

public class CuentaDetalleDTO {

    private long idInformeActividad;
    private Integer noInforme;
    private String numInforme;
    private String tipoInforme;
    private boolean requiereSecop;
    private boolean firmado;
    private String fechaInicio;
    private String fechaFin;

    private int idEstadoActual;
    private String estadoActual;
    private String fechaEstado;
    private String descripcionEstado;
    private String siguientePaso;

    private boolean activa;
    private List<CuentaPasoDTO> pasos = new ArrayList<>();

    public long getIdInformeActividad() { return idInformeActividad; }
    public void setIdInformeActividad(long idInformeActividad) { this.idInformeActividad = idInformeActividad; }
    public Integer getNoInforme() { return noInforme; }
    public void setNoInforme(Integer noInforme) { this.noInforme = noInforme; }
    public String getNumInforme() { return numInforme; }
    public void setNumInforme(String numInforme) { this.numInforme = numInforme; }
    public String getTipoInforme() { return tipoInforme; }
    public void setTipoInforme(String tipoInforme) { this.tipoInforme = tipoInforme; }
    public boolean isRequiereSecop() { return requiereSecop; }
    public void setRequiereSecop(boolean requiereSecop) { this.requiereSecop = requiereSecop; }
    public boolean isFirmado() { return firmado; }
    public void setFirmado(boolean firmado) { this.firmado = firmado; }
    public String getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(String fechaInicio) { this.fechaInicio = fechaInicio; }
    public String getFechaFin() { return fechaFin; }
    public void setFechaFin(String fechaFin) { this.fechaFin = fechaFin; }
    public int getIdEstadoActual() { return idEstadoActual; }
    public void setIdEstadoActual(int idEstadoActual) { this.idEstadoActual = idEstadoActual; }
    public String getEstadoActual() { return estadoActual; }
    public void setEstadoActual(String estadoActual) { this.estadoActual = estadoActual; }
    public String getFechaEstado() { return fechaEstado; }
    public void setFechaEstado(String fechaEstado) { this.fechaEstado = fechaEstado; }
    public String getDescripcionEstado() { return descripcionEstado; }
    public void setDescripcionEstado(String descripcionEstado) { this.descripcionEstado = descripcionEstado; }
    public String getSiguientePaso() { return siguientePaso; }
    public void setSiguientePaso(String siguientePaso) { this.siguientePaso = siguientePaso; }
    public boolean isActiva() { return activa; }
    public void setActiva(boolean activa) { this.activa = activa; }
    public List<CuentaPasoDTO> getPasos() { return pasos; }
    public void setPasos(List<CuentaPasoDTO> pasos) { this.pasos = pasos; }
}
