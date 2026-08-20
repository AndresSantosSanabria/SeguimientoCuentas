package com.sgcc.seguimientocuentas.contratos.domain.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ct_t_trazabilidad", schema = "contratistas")
public class CtTRazabilidad {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "no_contrato")
    private String noContrato;

    @Column(name = "descripcion")
    private String descripcion;

    @Column(name = "id_estado")
    private int idEstado;

    @Column(name = "fecha")
    private LocalDateTime fecha;

    @Column(name = "id_informe_actividad")
    private Long idInformeActividad;

    @Column(name = "id_ct_t_user_auto")
    private Long idUsuario;

    @Column(name = "tipo_registro")
    private int tipoRegistro;

    @Column(name = "no_ras")
    private Long noRas;

    @Column(name = "no_supervision")
    private Long noSupervision;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public int getIdEstado() { return idEstado; }
    public void setIdEstado(int idEstado) { this.idEstado = idEstado; }
    public LocalDateTime getFecha() { return fecha; }
    public void setFecha(LocalDateTime fecha) { this.fecha = fecha; }
    public Long getIdInformeActividad() { return idInformeActividad; }
    public void setIdInformeActividad(Long idInformeActividad) { this.idInformeActividad = idInformeActividad; }
    public Long getIdUsuario() { return idUsuario; }
    public void setIdUsuario(Long idUsuario) { this.idUsuario = idUsuario; }
    public int getTipoRegistro() { return tipoRegistro; }
    public void setTipoRegistro(int tipoRegistro) { this.tipoRegistro = tipoRegistro; }
    public Long getNoRas() { return noRas; }
    public void setNoRas(Long noRas) { this.noRas = noRas; }
    public Long getNoSupervision() { return noSupervision; }
    public void setNoSupervision(Long noSupervision) { this.noSupervision = noSupervision; }
}
