package com.sgcc.seguimientocuentas.accesos.application;

import com.sgcc.seguimientocuentas.accesos.adapter.out.jpa.GecorRepositorio;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Administracion de accesos: lista usuarios, roles y permisos, y aplica cambios
 * granulares sobre una persona sin tocar su rol.
 *
 * Toda operacion exige el permiso USUARIOS_ADMINISTRAR. El rol se sigue leyendo de
 * GECOR y los permisos sueltos se combinan con los del rol: conceder suma y denegar
 * resta, tal como lo resuelve {@link SesionService}.
 */
@Service
public class AccesosService {

    public static final String PERMISO_ADMINISTRAR = "USUARIOS_ADMINISTRAR";
    public static final String ROL_ADMIN = "ADMIN";

    private final GecorRepositorio repositorio;
    private final SesionService sesionService;

    public AccesosService(GecorRepositorio repositorio, SesionService sesionService) {
        this.repositorio = repositorio;
        this.sesionService = sesionService;
    }

    public record UsuarioAcceso(String keycloakId, String nombre, String correo, boolean activo,
                                String rolCodigo, String rolNombre, OffsetDateTime ultimoIngreso,
                                Map<String, Boolean> permisosDirectos) {}

    public record RolAcceso(String codigo, String nombre, String ambito, boolean activo,
                            int usuarios, List<String> permisos) {}

    public record PermisoAcceso(String codigo, String nombre, String modulo, String moduloNombre,
                                boolean activo, boolean moduloActivo) {}

    /** La pantalla completa exige el permiso; sin el, el backend responde 403. */
    public void exigirAdministrador() {
        if (!sesionService.alcanceActual().puede(PERMISO_ADMINISTRAR)) {
            throw new IllegalStateException("Se requiere el permiso " + PERMISO_ADMINISTRAR);
        }
    }

    public List<UsuarioAcceso> usuarios() {
        Map<String, Map<String, Boolean>> directos = repositorio.permisosDirectosTodos();
        return repositorio.usuarios().stream()
                .map(usuario -> new UsuarioAcceso(
                        usuario.keycloakId(),
                        usuario.nombre(),
                        usuario.correo(),
                        usuario.activo(),
                        usuario.rolCodigo(),
                        usuario.rolNombre(),
                        usuario.ultimoIngreso(),
                        directos.getOrDefault(usuario.keycloakId(), Map.of())))
                .toList();
    }

    public List<RolAcceso> roles() {
        Map<Integer, Long> conteo = repositorio.usuariosPorRol();
        return repositorio.roles().stream()
                .map(rol -> new RolAcceso(
                        rol.codigo(),
                        rol.nombre(),
                        rol.ambito(),
                        rol.activo(),
                        conteo.getOrDefault(rol.id(), 0L).intValue(),
                        repositorio.permisosDeRol(rol.id()).stream().sorted().toList()))
                .toList();
    }

    public List<PermisoAcceso> permisos() {
        return repositorio.permisos().stream()
                .map(permiso -> new PermisoAcceso(
                        permiso.codigo(),
                        permiso.nombre(),
                        permiso.modulo(),
                        permiso.moduloNombre(),
                        permiso.activo() && permiso.moduloActivo(),
                        permiso.moduloActivo()))
                .toList();
    }

    public void definirModulo(String codigo, boolean activo) {
        if (codigo == null || codigo.isBlank()
                || !repositorio.definirModuloActivo(codigo.trim().toUpperCase(), activo)) {
            throw new IllegalArgumentException("El módulo no existe");
        }
        sesionService.invalidarTodos();
    }

    /**
     * Un permiso granular nunca cambia el rol: solo agrega una excepcion sobre esa
     * persona. El alcance cacheado se invalida para que aplique de inmediato.
     */
    public void cambiarRol(String keycloakId, String rolCodigo) {
        String codigo = (rolCodigo == null || rolCodigo.isBlank()) ? null : rolCodigo.trim().toUpperCase();
        if (codigo != null && !repositorio.existeRol(codigo)) {
            throw new IllegalArgumentException("El rol " + codigo + " no existe");
        }
        if (!repositorio.cambiarRol(keycloakId, codigo)) {
            throw new IllegalArgumentException("El usuario " + keycloakId + " no existe");
        }
        sesionService.invalidar(keycloakId);
    }

    public void definirPermiso(String keycloakId, String permisoCodigo, Boolean permitir) {
        String codigo = permisoCodigo == null ? null : permisoCodigo.trim().toUpperCase();
        if (!repositorio.existePermiso(codigo)) {
            throw new IllegalArgumentException("El permiso " + permisoCodigo + " no existe");
        }
        repositorio.definirPermiso(keycloakId, codigo, permitir);
        sesionService.invalidar(keycloakId);
    }
}
