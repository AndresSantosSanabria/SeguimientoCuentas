package com.sgcc.seguimientocuentas.common.dto;

public class CuentaPasoDTO {

    private int idEstado;
    private String estado;
    private String fecha;
    private String descripcion;
    private String usuario;
    /** El rol de quien hizo el movimiento: supervisor, enlace, abogado, tesoreria... */
    private String rolUsuario;
    /** Quien recibio la cuenta en este movimiento: es quien la tiene en sus manos. */
    private String destinatario;
    private String rolDestinatario;

    public int getIdEstado() { return idEstado; }
    public void setIdEstado(int idEstado) { this.idEstado = idEstado; }
    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }
    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    /** Quien dejó la cuenta en ese estado: el usuario de la trazabilidad. */
    public String getUsuario() { return usuario; }
    public void setUsuario(String usuario) { this.usuario = usuario; }
    public String getRolUsuario() { return rolUsuario; }
    public void setRolUsuario(String rolUsuario) { this.rolUsuario = rolUsuario; }
    public String getDestinatario() { return destinatario; }
    public void setDestinatario(String destinatario) { this.destinatario = destinatario; }
    public String getRolDestinatario() { return rolDestinatario; }
    public void setRolDestinatario(String rolDestinatario) { this.rolDestinatario = rolDestinatario; }
}
