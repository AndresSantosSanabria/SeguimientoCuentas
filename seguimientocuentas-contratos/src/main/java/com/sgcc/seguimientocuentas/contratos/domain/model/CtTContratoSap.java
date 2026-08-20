package com.sgcc.seguimientocuentas.contratos.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "ct_t_contrato_sap", schema = "contratacion")
public class CtTContratoSap {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "no_contrato")
    private String noContrato;

    @Column(name = "contratista")
    private String contratista;

    @Column(name = "valor_total")
    private BigDecimal valorTotal;

    @Column(name = "recepcion_facturas")
    private BigDecimal recepcionFacturas;

    @Column(name = "saldo")
    private BigDecimal saldo;

    @Column(name = "fecha_inicio")
    private String fechaInicio;

    @Column(name = "fecha_fin")
    private String fechaFin;

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
}
