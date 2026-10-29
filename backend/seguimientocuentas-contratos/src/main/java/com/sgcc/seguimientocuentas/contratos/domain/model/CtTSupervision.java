package com.sgcc.seguimientocuentas.contratos.domain.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "ct_t_supervision", schema = "contratacion")
public class CtTSupervision {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "no_supervision")
    private Integer noSupervision;

    @Column(name = "no_contrato")
    private String noContrato;

    @Column(name = "fecha_desde")
    private LocalDate fechaDesde;

    @Column(name = "fecha_hasta")
    private LocalDate fechaHasta;

    @Column(name = "porcentaje_avance")
    private Short porcentajeAvance;

    @Column(name = "valor_pago")
    private Double valorPago;

    @Column(name = "id_informe_actividad")
    private Long idInformeActividad;

    @Column(name = "id_supervisor")
    private Long idSupervisor;

    @Column(name = "en_firme")
    private Boolean enFirme;

    @Column(name = "saldo_contratista")
    private Long saldoContratista;

    @Column(name = "saldo_entidad")
    private Long saldoEntidad;

    @Column(name = "responsable_financiero")
    private String responsableFinanciero;

    @Column(name = "responsable_cierre")
    private String responsableCierre;

    @Column(name = "observacion")
    private String observacion;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getNoSupervision() { return noSupervision; }
    public void setNoSupervision(Integer noSupervision) { this.noSupervision = noSupervision; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public LocalDate getFechaDesde() { return fechaDesde; }
    public void setFechaDesde(LocalDate fechaDesde) { this.fechaDesde = fechaDesde; }
    public LocalDate getFechaHasta() { return fechaHasta; }
    public void setFechaHasta(LocalDate fechaHasta) { this.fechaHasta = fechaHasta; }
    public Short getPorcentajeAvance() { return porcentajeAvance; }
    public void setPorcentajeAvance(Short porcentajeAvance) { this.porcentajeAvance = porcentajeAvance; }
    public Double getValorPago() { return valorPago; }
    public void setValorPago(Double valorPago) { this.valorPago = valorPago; }
    public Long getIdInformeActividad() { return idInformeActividad; }
    public void setIdInformeActividad(Long idInformeActividad) { this.idInformeActividad = idInformeActividad; }
    public Long getIdSupervisor() { return idSupervisor; }
    public void setIdSupervisor(Long idSupervisor) { this.idSupervisor = idSupervisor; }
    public Boolean getEnFirme() { return enFirme; }
    public void setEnFirme(Boolean enFirme) { this.enFirme = enFirme; }
    public Long getSaldoContratista() { return saldoContratista; }
    public void setSaldoContratista(Long saldoContratista) { this.saldoContratista = saldoContratista; }
    public Long getSaldoEntidad() { return saldoEntidad; }
    public void setSaldoEntidad(Long saldoEntidad) { this.saldoEntidad = saldoEntidad; }
    public String getResponsableFinanciero() { return responsableFinanciero; }
    public void setResponsableFinanciero(String responsableFinanciero) { this.responsableFinanciero = responsableFinanciero; }
    public String getResponsableCierre() { return responsableCierre; }
    public void setResponsableCierre(String responsableCierre) { this.responsableCierre = responsableCierre; }
    public String getObservacion() { return observacion; }
    public void setObservacion(String observacion) { this.observacion = observacion; }
}
