package com.sgcc.gestion.entities;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "ct_pago", schema = "contratacion")
public class CtPago {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "fecha_factura")
    private LocalDate fechaFactura;

    @Column(name = "no_factura")
    private Long noFactura;

    @Column(name = "no_pago")
    private Short noPago;

    @Column(name = "fecha_pago")
    private LocalDate fechaPago;

    @Column(name = "valor")
    private Double valor;

    @Column(name = "id_ct_t_contrato_sap")
    private Long idContratoSap;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public LocalDate getFechaFactura() { return fechaFactura; }
    public void setFechaFactura(LocalDate fechaFactura) { this.fechaFactura = fechaFactura; }
    public Long getNoFactura() { return noFactura; }
    public void setNoFactura(Long noFactura) { this.noFactura = noFactura; }
    public Short getNoPago() { return noPago; }
    public void setNoPago(Short noPago) { this.noPago = noPago; }
    public LocalDate getFechaPago() { return fechaPago; }
    public void setFechaPago(LocalDate fechaPago) { this.fechaPago = fechaPago; }
    public Double getValor() { return valor; }
    public void setValor(Double valor) { this.valor = valor; }
    public Long getIdContratoSap() { return idContratoSap; }
    public void setIdContratoSap(Long idContratoSap) { this.idContratoSap = idContratoSap; }
}
