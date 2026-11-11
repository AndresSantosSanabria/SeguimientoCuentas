package com.sgcc.seguimientocuentas.accesos.application;

import com.sgcc.seguimientocuentas.accesos.adapter.out.jpa.GecorRepositorio;
import com.sgcc.seguimientocuentas.accesos.config.GecorProperties;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resuelve el alcance de la persona conectada: que rol tiene, que permisos puede usar y a que
 * secretarias puede ver los contratos.
 *
 * El token de Keycloak dice quien es (sub, nombre, correo) y que roles trae. Lo que el token NO
 * dice es que puede hacer dentro de la aplicacion: eso vive en GECOR. Por eso el token nunca decide
 * permisos, solo identidad y roles.
 *
 * El resultado se cachea unos segundos porque cada peticion de la lista de contratos necesita el
 * alcance y no tiene sentido pegarle a la base de permisos en cada una.
 */
@Service
public class SesionService {

    private static final Logger log = LoggerFactory.getLogger(SesionService.class);

    /** Rol que se asigna al administrador inicial la primera vez que entra. */
    private static final String ROL_ADMIN = "ADMIN";

    /** Claims donde Keycloak puede dejar la secretaria de la persona. */
    private static final List<String> CLAIMS_SECRETARIA =
            List.of("secretaria", "secretaría", "dependencia", "departamento");

    private final GecorRepositorio repositorio;
    private final GecorProperties properties;
    private final String clientId;
    private final boolean authEnabled;

    private final Map<String, Cache> cache = new ConcurrentHashMap<>();

    public SesionService(GecorRepositorio repositorio,
                          GecorProperties properties,
                          @Value("${keycloak.client-id:ge-cor}") String clientId,
                          @Value("${auth.enabled:true}") boolean authEnabled) {
        this.repositorio = repositorio;
        this.properties = properties;
        this.clientId = clientId;
        this.authEnabled = authEnabled;
    }

    /** El alcance de quien esta usando la peticion en curso. */
    public AmbitoUsuario alcanceActual() {
        if (!authEnabled) {
            return AmbitoUsuario.sinAlcance(null, null, null);
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            return alcanceDe(token.getToken());
        }
        return AmbitoUsuario.sinAlcance(null, null, null);
    }

    /** El alcance de una conexion del WebSocket, donde el token llega en el handshake. */
    public AmbitoUsuario alcanceDeConexion(Jwt jwt) {
        if (!authEnabled) {
            return AmbitoUsuario.sinAlcance(null, null, null);
        }
        if (jwt == null) {
            return AmbitoUsuario.sinAlcance(null, null, null);
        }
        return alcanceDe(jwt);
    }

    /** El alcance de una persona concreta, por su token. */
    public AmbitoUsuario alcanceDe(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        String nombre = primeroNoVacio(jwt.getClaimAsString("name"),
                jwt.getClaimAsString("preferred_username"), keycloakId);
        String correo = jwt.getClaimAsString("email");

        if (!properties.configurada()) {
            return AmbitoUsuario.sinAlcance(keycloakId, nombre, correo);
        }

        Cache guardada = cache.get(keycloakId);
        if (guardada != null && guardada.expiraEn() > System.currentTimeMillis()) {
            return guardada.ambito();
        }

        AmbitoUsuario ambito = calcular(jwt, keycloakId, nombre, correo);
        cache.put(keycloakId, new Cache(ambito,
                System.currentTimeMillis() + properties.getTtlSesionSegundos() * 1000));
        return ambito;
    }

    private AmbitoUsuario calcular(Jwt jwt, String keycloakId, String nombre, String correo) {
        try {
            if (!properties.configurada()) {
                // Fail closed: without GECOR no permission or account scope can be established.
                return AmbitoUsuario.sinAlcance(keycloakId, nombre, correo);
            }
            asegurarUsuario(keycloakId, nombre, correo);
            Optional<GecorRepositorio.Usuario> usuario = repositorio.usuario(keycloakId);

            // El rol asignado en GECOR manda; si no hay, se usan los roles del token que existan aqui.
            GecorRepositorio.Usuario datos = usuario.orElse(null);
            List<GecorRepositorio.Rol> roles = datos != null && datos.rolId() != null
                    ? List.of(new GecorRepositorio.Rol(datos.rolId(), datos.rolCodigo(), datos.rolNombre()))
                    : List.of();

            GecorRepositorio.Rol principal = roles.isEmpty() ? null : roles.get(0);
            String rolCodigo = principal == null ? null : principal.codigo();
            String rolNombre = principal == null ? null : principal.nombre();

            Set<String> permisos = new LinkedHashSet<>();
            for (GecorRepositorio.Rol rol : roles) {
                permisos.addAll(repositorio.permisosDeRol(rol.id()));
            }
            Map<String, Boolean> directos = repositorio.permisosDirectos(keycloakId);
            directos.forEach((codigo, permitir) -> {
                if (permitir) {
                    permisos.add(codigo);
                } else {
                    permisos.remove(codigo);
                }
            });

            Set<String> secretarias = new LinkedHashSet<>();
            secretarias.addAll(repositorio.secretariasDelUsuario(keycloakId));
            for (GecorRepositorio.Rol rol : roles) {
                secretarias.addAll(repositorio.secretariasDeRol(rol.id()));
            }
            secretarias.remove(null);

            boolean verTodas = permisos.contains(AmbitoUsuario.PERMISO_VER_TODAS);
            Set<String> codigosRol = roles.stream()
                    .map(GecorRepositorio.Rol::codigo)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            return new AmbitoUsuario(keycloakId, nombre, correo, rolCodigo, rolNombre,
                    codigosRol, permisos, secretarias, verTodas);
        } catch (Exception e) {
            // Si la base de permisos no responde no se abre la puerta: el alcance queda vacio.
            log.error("No se pudo calcular el alcance de {}: {}", keycloakId, e.getMessage());
            return AmbitoUsuario.sinAlcance(keycloakId, nombre, correo);
        }
    }

    /** Registra el ingreso de la persona; el alta del usuario se asegura antes del ingreso. */
    public void registrarIngreso(Jwt jwt, String origen) {
        if (!properties.configurada()) {
            return;
        }
        String keycloakId = jwt.getSubject();
        String nombre = primeroNoVacio(jwt.getClaimAsString("name"),
                jwt.getClaimAsString("preferred_username"), keycloakId);
        String correo = jwt.getClaimAsString("email");
        try {
            asegurarUsuario(keycloakId, nombre, correo);
            repositorio.registrarIngreso(keycloakId, origen);
        } catch (Exception e) {
            log.error("No se pudo registrar el ingreso de {}: {}", keycloakId, e.getMessage());
        }
    }

    /**
     * Deja el usuario en GECOR antes de resolver su alcance. El correo y el nombre se
     * refrescan con lo que trae el token en cada calculo (el alcance esta cacheado).
     */
    private void asegurarUsuario(String keycloakId, String nombre, String correo) {
        repositorio.guardarUsuario(keycloakId, nombre, correo);
        if (esAdministradorInicial(nombre, correo)) {
            repositorio.asignarRolSiFalta(keycloakId, ROL_ADMIN);
        } else {
            repositorio.asignarRolSiFalta(keycloakId, "BASICO");
        }
    }

    /**
     * Bootstrap del administrador: la primera vez que entra una de las personas
     * configuradas se le asigna ADMIN si todavia no tiene rol. Despues manda GECOR,
     * asi que un cambio manual de rol no se pisa en cada ingreso.
     */
    private boolean esAdministradorInicial(String nombre, String correo) {
        if (correo != null && !correo.isBlank()) {
            String buscado = correo.trim().toLowerCase(Locale.ROOT);
            boolean coincide = properties.getAdminCorreos().stream()
                    .filter(valor -> valor != null && !valor.isBlank())
                    .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                    .anyMatch(buscado::equals);
            if (coincide) {
                return true;
            }
        }
        if (nombre != null && !nombre.isBlank()) {
            String buscado = AmbitoUsuario.normalizar(nombre);
            return properties.getAdminNombres().stream()
                    .filter(valor -> valor != null && !valor.isBlank())
                    .map(AmbitoUsuario::normalizar)
                    .anyMatch(buscado::equals);
        }
        return false;
    }

    /** Roles del realm y del cliente: Keycloak los reparte en los dos sitios. */
    private Set<String> rolesDelToken(Jwt jwt) {
        Set<String> roles = new LinkedHashSet<>();
        Map<String, Object> realm = jwt.getClaimAsMap("realm_access");
        if (realm != null) {
            Object lista = realm.get("roles");
            if (lista instanceof Iterable<?> valores) {
                valores.forEach(valor -> roles.add(String.valueOf(valor)));
            }
        }
        Map<String, Object> recursos = jwt.getClaimAsMap("resource_access");
        if (recursos != null) {
            Object delCliente = recursos.get(clientId);
            if (delCliente instanceof Map<?, ?> mapa) {
                Object lista = mapa.get("roles");
                if (lista instanceof Iterable<?> valores) {
                    valores.forEach(valor -> roles.add(String.valueOf(valor)));
                }
            }
        }
        return roles;
    }

    /** La secretaria puede venir como claim del token, como texto o como lista. */
    private Set<String> secretariasDelClaim(Jwt jwt) {
        Set<String> secretarias = new LinkedHashSet<>();
        for (String claim : CLAIMS_SECRETARIA) {
            Object valor = jwt.getClaims().get(claim);
            if (valor instanceof String texto) {
                addCodigo(secretarias, texto);
            } else if (valor instanceof Iterable<?> valores) {
                valores.forEach(item -> addCodigo(secretarias, String.valueOf(item)));
            }
        }
        return secretarias;
    }

    private static void addCodigo(Set<String> destino, String valor) {
        String codigo = AmbitoUsuario.normalizar(valor);
        if (codigo != null) {
            destino.add(codigo);
        }
    }

    private static String primeroNoVacio(String... valores) {
        for (String valor : valores) {
            if (valor != null && !valor.isBlank()) {
                return valor;
            }
        }
        return null;
    }

    /** Descarta el alcance cacheado: se usa cuando cambia el rol o los permisos de alguien. */
    public void invalidar(String keycloakId) {
        cache.remove(keycloakId);
    }

    public void invalidarTodos() {
        cache.clear();
    }

    public List<String> secretariasCatalogo() {
        return repositorio.secretarias().stream().map(GecorRepositorio.Secretaria::codigo).toList();
    }

    private record Cache(AmbitoUsuario ambito, long expiraEn) {}
}
