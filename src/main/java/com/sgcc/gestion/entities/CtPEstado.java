package com.sgcc.gestion.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "ct_p_estado", schema = "contratistas")
public class CtPEstado {

    @Id
    @Column(name = "id")
    private Integer id;

    @Column(name = "descripcion")
    private String descripcion;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }
}
