package com.sgcc.seguimientocuentas.contratos.domain.model;

import java.util.Map;

/**
 * Los catalogos que traducen codigos a texto en el payload: estados del workflow, siguiente paso
 * sugerido, nombres de los supervisores y las personas de la trazabilidad con su rol. Se leen una vez
 * al arrancar y se refrescan cuando el CDC avisa de un cambio en ct_p_estado o en t_usuarios, para no
 * volver a la base por un renombrado.
 */
public record Catalogos(Map<Integer, String> estados,
                        Map<Integer, String> siguientesPasos,
                        Map<Long, String> supervisores,
                        Map<Long, UsuarioAuto> usuariosAuto) {

    public String nombreEstado(int idEstado) {
        return estados.getOrDefault(idEstado, "Estado " + idEstado);
    }

    public String siguientePaso(int idEstado) {
        return siguientesPasos.get(idEstado);
    }

    public String nombreSupervisor(Long idSupervisor) {
        return supervisores.get(idSupervisor);
    }

    /**
     * La persona que dejó la cuenta en un estado. La trazabilidad guarda el id de ct_t_user_auto,
     * no el del usuario, así que el nombre se busca por esa tabla.
     */
    public UsuarioAuto usuarioAuto(Long idUsuarioAuto) {
        return idUsuarioAuto == null ? null : usuariosAuto.get(idUsuarioAuto);
    }

    public String nombreUsuario(Long idUsuarioAuto) {
        UsuarioAuto usuario = usuarioAuto(idUsuarioAuto);
        return usuario != null ? usuario.nombre() : null;
    }

    /** El rol de la persona: es lo que dice quién tiene la cuenta en sus manos. */
    public String rolUsuario(Long idUsuarioAuto) {
        UsuarioAuto usuario = usuarioAuto(idUsuarioAuto);
        return usuario != null ? usuario.rol() : null;
    }
}
