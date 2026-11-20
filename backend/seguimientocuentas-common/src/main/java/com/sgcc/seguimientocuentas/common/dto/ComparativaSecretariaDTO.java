package com.sgcc.seguimientocuentas.common.dto;

import java.math.BigDecimal;

/**
 * Como ve una secretaria el proceso de cobro: solo datos agregados de sus contratos,
 * nunca el detalle de un contrato ni de una persona.
 */
public class ComparativaSecretariaDTO {

    private String secretaria;
    private int contratos;
    private long radicadas;
    private long exigibles;
    private long completadas;
    private long pendientes;
    private long enMora;
    private long contratosConMora;
    private double cobertura;
    private BigDecimal valorTotal;

    public String getSecretaria() { return secretaria; }
    public void setSecretaria(String secretaria) { this.secretaria = secretaria; }
    public int getContratos() { return contratos; }
    public void setContratos(int contratos) { this.contratos = contratos; }
    public long getRadicadas() { return radicadas; }
    public void setRadicadas(long radicadas) { this.radicadas = radicadas; }
    public long getExigibles() { return exigibles; }
    public void setExigibles(long exigibles) { this.exigibles = exigibles; }
    public long getCompletadas() { return completadas; }
    public void setCompletadas(long completadas) { this.completadas = completadas; }
    public long getPendientes() { return pendientes; }
    public void setPendientes(long pendientes) { this.pendientes = pendientes; }
    public long getEnMora() { return enMora; }
    public void setEnMora(long enMora) { this.enMora = enMora; }
    public long getContratosConMora() { return contratosConMora; }
    public void setContratosConMora(long contratosConMora) { this.contratosConMora = contratosConMora; }
    public double getCobertura() { return cobertura; }
    public void setCobertura(double cobertura) { this.cobertura = cobertura; }
    public BigDecimal getValorTotal() { return valorTotal; }
    public void setValorTotal(BigDecimal valorTotal) { this.valorTotal = valorTotal; }
}
