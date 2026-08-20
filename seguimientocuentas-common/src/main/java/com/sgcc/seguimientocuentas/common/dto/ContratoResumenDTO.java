package com.sgcc.seguimientocuentas.common.dto;

import java.math.BigDecimal;

public class ContratoResumenDTO {

    private Long id;
    private String noContrato;
    private String contratista;
    private BigDecimal valorTotal;
    private BigDecimal recepcionFacturas;
    private BigDecimal saldo;
    private String fechaInicio;
    private String fechaFin;

    private int totalSupervisiones;
    private int totalSupervisionesEsperadas;
    private short porcentajeAvance;
    private boolean informeCargado;

    private int idEstadoActual;
    private String estadoActual;
    private String descripcion;
    private String siguientePaso;
    private String fechaEstado;

    private boolean rasCreado;
    private int totalFondos;
    private double valorInicialRas;
    private double saldoRas;

    private int totalPagos;
    private double totalPagado;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public String getContratista() { return contratista; }
    public void setContratista(String contratista) { this.contratista = contratista; }
    public BigDecimal getValorTotal() { return valorTotal; }
    public void setValorTotal(BigDecimal valorTotal) { this.valorTotal = valorTotal; }
    public BigDecimal getRecepcionFacturas() { return recepcionFacturas; }
    public void setRecepcionFacturas(BigDecimal recepcionFacturas) { this.recepcionFacturas = recepcionFacturas; }
    public BigDecimal getSaldo() { return saldo; }
    public void setSaldo(BigDecimal saldo) { this.saldo = saldo; }
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
    public boolean isInformeCargado() { return informeCargado; }
    public void setInformeCargado(boolean informeCargado) { this.informeCargado = informeCargado; }
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
    public boolean isRasCreado() { return rasCreado; }
    public void setRasCreado(boolean rasCreado) { this.rasCreado = rasCreado; }
    public int getTotalFondos() { return totalFondos; }
    public void setTotalFondos(int totalFondos) { this.totalFondos = totalFondos; }
    public double getValorInicialRas() { return valorInicialRas; }
    public void setValorInicialRas(double valorInicialRas) { this.valorInicialRas = valorInicialRas; }
    public double getSaldoRas() { return saldoRas; }
    public void setSaldoRas(double saldoRas) { this.saldoRas = saldoRas; }
    public int getTotalPagos() { return totalPagos; }
    public void setTotalPagos(int totalPagos) { this.totalPagos = totalPagos; }
    public double getTotalPagado() { return totalPagado; }
    public void setTotalPagado(double totalPagado) { this.totalPagado = totalPagado; }
}
