package com.sgcc.seguimientocuentas.common.dto;

import java.util.ArrayList;
import java.util.List;

public class ContratoResumenDTO {

    private Long id;
    private String noContrato;
    private String contratista;
    private String dependencia;
    private String supervisor;
    private String fechaInicio;
    private String fechaFin;

    private int totalSupervisiones;
    private int totalSupervisionesEsperadas;
    private short porcentajeAvance;
    private short avanceDeclarado;
    private boolean informeCargado;

    private int cuentasRegistradas;
    private int cuentasEsperadas;
    private int cuentasExigibles;
    private int cuentasEnMora;

    private int idEstadoActual;
    private String estadoActual;
    private String descripcion;
    private String siguientePaso;
    private String fechaEstado;

    private List<CuentaDetalleDTO> cuentasDetalle = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public String getContratista() { return contratista; }
    public void setContratista(String contratista) { this.contratista = contratista; }
    public String getDependencia() { return dependencia; }
    public void setDependencia(String dependencia) { this.dependencia = dependencia; }
    public String getSupervisor() { return supervisor; }
    public void setSupervisor(String supervisor) { this.supervisor = supervisor; }
    public String getFechaInicio() { return fechaInicio; }
    public void setFechaInicio(String fechaInicio) { this.fechaInicio = fechaInicio; }
    public String getFechaFin() { return fechaFin; }
    public void setFechaFin(String fechaFin) { this.fechaFin = fechaFin; }
    public int getTotalSupervisiones() { return totalSupervisiones; }
    public void setTotalSupervisiones(int totalSupervisiones) { this.totalSupervisiones = totalSupervisiones; }
    public int getTotalSupervisionesEsperadas() { return totalSupervisionesEsperadas; }
    public void setTotalSupervisionesEsperadas(int totalSupervisionesEsperadas) { this.totalSupervisionesEsperadas = totalSupervisionesEsperadas; }
    public short getPorcentajeAvance() { return porcentajeAvance; }
    public void setPorcentajeAvance(short porcentajeAvance) { this.porcentajeAvance = porcentajeAvance; }
    public short getAvanceDeclarado() { return avanceDeclarado; }
    public void setAvanceDeclarado(short avanceDeclarado) { this.avanceDeclarado = avanceDeclarado; }
    public boolean isInformeCargado() { return informeCargado; }
    public void setInformeCargado(boolean informeCargado) { this.informeCargado = informeCargado; }
    public int getCuentasRegistradas() { return cuentasRegistradas; }
    public void setCuentasRegistradas(int cuentasRegistradas) { this.cuentasRegistradas = cuentasRegistradas; }
    public int getCuentasEsperadas() { return cuentasEsperadas; }
    public void setCuentasEsperadas(int cuentasEsperadas) { this.cuentasEsperadas = cuentasEsperadas; }
    public int getCuentasExigibles() { return cuentasExigibles; }
    public void setCuentasExigibles(int cuentasExigibles) { this.cuentasExigibles = cuentasExigibles; }
    public int getCuentasEnMora() { return cuentasEnMora; }
    public void setCuentasEnMora(int cuentasEnMora) { this.cuentasEnMora = cuentasEnMora; }
    public int getIdEstadoActual() { return idEstadoActual; }
    public void setIdEstadoActual(int idEstadoActual) { this.idEstadoActual = idEstadoActual; }
    public String getEstadoActual() { return estadoActual; }
    public void setEstadoActual(String estadoActual) { this.estadoActual = estadoActual; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public String getSiguientePaso() { return siguientePaso; }
    public void setSiguientePaso(String siguientePaso) { this.siguientePaso = siguientePaso; }
    public String getFechaEstado() { return fechaEstado; }
    public void setFechaEstado(String fechaEstado) { this.fechaEstado = fechaEstado; }
    public List<CuentaDetalleDTO> getCuentasDetalle() { return cuentasDetalle; }
    public void setCuentasDetalle(List<CuentaDetalleDTO> cuentasDetalle) { this.cuentasDetalle = cuentasDetalle; }
}
