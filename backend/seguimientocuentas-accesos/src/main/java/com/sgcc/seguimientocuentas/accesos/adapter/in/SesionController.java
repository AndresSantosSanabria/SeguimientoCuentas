package com.sgcc.seguimientocuentas.accesos.adapter.in;

import com.sgcc.seguimientocuentas.accesos.application.SesionService;
import com.sgcc.seguimientocuentas.accesos.application.SecretariasUsuarioResolver;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.LinkedHashSet;

/**
 * Lo que la pantalla necesita saber de la persona conectada: su rol, sus permisos y a que
 * secretarias puede ver. El frontend lo consulta una vez al entrar y con eso decide que menus
 * muestra y que botones habilita.
 */
@RestController
@RequestMapping("/api/sesion")
public class SesionController {

    private final SesionService sesionService;
    private final ObjectProvider<SecretariasUsuarioResolver> secretariasResolver;

    public SesionController(SesionService sesionService,
                            ObjectProvider<SecretariasUsuarioResolver> secretariasResolver) {
        this.sesionService = sesionService;
        this.secretariasResolver = secretariasResolver;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public SesionDTO sesion() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            sesionService.registrarIngreso(token.getToken(), "web");
        }
        AmbitoUsuario ambito = sesionService.alcanceActual();
        LinkedHashSet<String> secretarias = new LinkedHashSet<>(ambito.secretarias());
        SecretariasUsuarioResolver resolver = secretariasResolver.getIfAvailable();
        if (resolver != null) {
            try {
                secretarias.addAll(resolver.secretariasPorCorreo(ambito.correo()));
            } catch (Exception ignored) {
                // Si la consulta de solo lectura falla, la sesión conserva las asignaciones de GECOR.
            }
        }
        return new SesionDTO(
                new UsuarioDTO(ambito.keycloakId(), ambito.nombre(), ambito.correo()),
                ambito.rolCodigo() == null ? null : new RolDTO(ambito.rolCodigo(), ambito.rolNombre()),
                ambito.permisos().stream().sorted().toList(),
                secretarias.stream().sorted().toList(),
                ambito.verTodasSecretarias());
    }

    public record SesionDTO(UsuarioDTO usuario, RolDTO rol, List<String> permisos,
                            List<String> secretarias, boolean verTodasSecretarias) {}

    public record UsuarioDTO(String keycloakId, String nombre, String correo) {}

    public record RolDTO(String codigo, String nombre) {}
}
