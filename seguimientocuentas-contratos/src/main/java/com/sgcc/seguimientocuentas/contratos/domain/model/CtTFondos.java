package com.sgcc.seguimientocuentas.contratos.domain.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "ct_t_fondos", schema = "ras")
public class CtTFondos {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "no_contrato")
    private String noContrato;

    @Column(name = "valor_inicial")
    private Double valorInicial;

    @Column(name = "saldo")
    private Double saldo;

    @Column(name = "valor_pagar")
    private Double valorPagar;

    @Column(name = "fondo")
    private String fondo;

    @Column(name = "nombre_fondo")
    private String nombreFondo;

    @Column(name = "fecha_entrega")
    private LocalDate fechaEntrega;

    @Column(name = "ct_t_ras_id")
    private Integer rasId;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public Double getValorInicial() { return valorInicial; }
    public void setValorInicial(Double valorInicial) { this.valorInicial = valorInicial; }
    public Double getSaldo() { return saldo; }
    public void setSaldo(Double saldo) { this.saldo = saldo; }
    public Double getValorPagar() { return valorPagar; }
    public void setValorPagar(Double valorPagar) { this.valorPagar = valorPagar; }
    public String getFondo() { return fondo; }
    public void setFondo(String fondo) { this.fondo = fondo; }
    public String getNombreFondo() { return nombreFondo; }
    public void setNombreFondo(String nombreFondo) { this.nombreFondo = nombreFondo; }
    public LocalDate getFechaEntrega() { return fechaEntrega; }
    public void setFechaEntrega(LocalDate fechaEntrega) { this.fechaEntrega = fechaEntrega; }
    public Integer getRasId() { return rasId; }
    public void setRasId(Integer rasId) { this.rasId = rasId; }
}
