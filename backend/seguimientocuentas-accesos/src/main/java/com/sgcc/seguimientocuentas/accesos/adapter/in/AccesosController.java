package com.sgcc.seguimientocuentas.accesos.adapter.in;

import com.sgcc.seguimientocuentas.accesos.application.AccesosService;
import com.sgcc.seguimientocuentas.accesos.application.AccesosService.PermisoAcceso;
import com.sgcc.seguimientocuentas.accesos.application.AccesosService.RolAcceso;
import com.sgcc.seguimientocuentas.accesos.application.AccesosService.UsuarioAcceso;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Pantalla de configuracion de accesos: usuarios, roles y permisos.
 *
 * Leer y escribir aqui exige USUARIOS_ADMINISTRAR. Los permisos granulares se
 * aplican directo sobre el usuario, independientemente del rol que tenga.
 */
@RestController
@RequestMapping("/api/accesos")
public class AccesosController {

    private final AccesosService service;

    public AccesosController(AccesosService service) {
        this.service = service;
    }

    public record RolRequest(String rolCodigo) {}

    public record PermisoRequest(Boolean permitir) {}
    public record ModuloRequest(Boolean activo) {}

    @GetMapping(value = "/usuarios", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<UsuarioAcceso> usuarios() {
        return conGuardia(service::usuarios);
    }

    @GetMapping(value = "/roles", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<RolAcceso> roles() {
        return conGuardia(service::roles);
    }

    @GetMapping(value = "/permisos", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<PermisoAcceso> permisos() {
        return conGuardia(service::permisos);
    }

    @PutMapping(value = "/modulos/{codigo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void definirModulo(@PathVariable String codigo, @RequestBody ModuloRequest peticion) {
        conGuardia(() -> {
            if (peticion == null || peticion.activo() == null) {
                throw new IllegalArgumentException("Se requiere el estado activo del módulo");
            }
            service.definirModulo(codigo, peticion.activo());
            return null;
        });
    }

    @PutMapping(value = "/usuarios/{keycloakId}/rol")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarRol(@PathVariable String keycloakId,
                           @RequestBody(required = false) RolRequest peticion) {
        conGuardia(() -> {
            service.cambiarRol(keycloakId, peticion == null ? null : peticion.rolCodigo());
            return null;
        });
    }

    @PutMapping(value = "/usuarios/{keycloakId}/permisos/{codigo}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void definirPermiso(@PathVariable String keycloakId,
                               @PathVariable String codigo,
                               @RequestBody(required = false) PermisoRequest peticion) {
        conGuardia(() -> {
            service.definirPermiso(keycloakId, codigo,
                    peticion == null ? null : peticion.permitir());
            return null;
        });
    }

    /** Traduce la falta de permiso a 403 y las validaciones a 400. */
    private <T> T conGuardia(java.util.function.Supplier<T> accion) {
        try {
            service.exigirAdministrador();
            return accion.get();
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage(), e);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }
}
