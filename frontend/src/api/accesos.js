import { getJson, putJson } from '@/api/client';

/** Listado de usuarios con su rol y sus permisos sueltos (conceder/denegar). */
export function fetchUsuariosAcceso() {
    return getJson('/api/accesos/usuarios');
}

/** Roles del catalogo con los permisos que hereda cada uno. */
export function fetchRolesAcceso() {
    return getJson('/api/accesos/roles');
}

/** Catalogo completo de permisos, agrupado por modulo en la interfaz. */
export function fetchPermisosAcceso() {
    return getJson('/api/accesos/permisos');
}

/** Cambia el rol de una persona. `null` la deja sin rol. */
export function cambiarRolUsuario(keycloakId, rolCodigo) {
    return putJson(`/api/accesos/usuarios/${encodeURIComponent(keycloakId)}/rol`, { rolCodigo });
}

/** Permiso granular: true concede, false deniega y null vuelve a heredar del rol. */
export function definirPermisoUsuario(keycloakId, codigo, permitir) {
    return putJson(
        `/api/accesos/usuarios/${encodeURIComponent(keycloakId)}/permisos/${encodeURIComponent(codigo)}`,
        { permitir },
    );
}

export function definirModuloAcceso(codigo, activo) {
    return putJson(`/api/accesos/modulos/${encodeURIComponent(codigo)}`, { activo });
}
