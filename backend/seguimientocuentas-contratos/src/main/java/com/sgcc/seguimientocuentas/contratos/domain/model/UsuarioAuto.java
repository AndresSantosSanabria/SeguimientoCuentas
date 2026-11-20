package com.sgcc.seguimientocuentas.contratos.domain.model;

/**
 * La persona que aparece en la trazabilidad, con el rol que tiene en la plataforma.
 *
 * La trazabilidad no guarda el usuario directo: guarda el id de la fila de ct_t_user_auto, que a su
 * vez apunta al usuario de t_usuarios y al rol (supervisor, enlace, abogado, tesorería...). Resolver
 * por esa ruta es lo que permite decir no solo quién se movió, sino con qué rol.
 */
public record UsuarioAuto(String nombre, String rol) {
}
