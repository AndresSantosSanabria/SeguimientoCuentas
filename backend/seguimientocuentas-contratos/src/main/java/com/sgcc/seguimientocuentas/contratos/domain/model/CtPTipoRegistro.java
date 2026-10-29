package com.sgcc.seguimientocuentas.contratos.domain.model;

import jakarta.persistence.*;

@Entity
@Table(name = "ct_p_tipo_registro", schema = "contratistas")
public class CtPTipoRegistro {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "nombre")
    private String nombre;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
}
