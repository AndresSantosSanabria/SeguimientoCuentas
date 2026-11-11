package com.sgcc.seguimientocuentas.accesos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.accesos.config.GecorDatabase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Acceso a la base GECOR. Solo JDBC: la base de permisos es pequena y no necesita un ORM.
 *
 * Cuando la base esta apagada o no responde, los metodos devuelven vacio en vez de romper la
 * peticion: el servicio de sesion es quien decide si eso significa alcance completo o alcance vacio.
 *
 * Los catalogos se buscan por su codigo (ya normalizado en mayusculas) y las relaciones por id:
 * asi el indice unico de cada catalogo se usa tal cual, sin funciones sobre la columna.
 */
@Repository
public class GecorRepositorio {

    private static final Logger log = LoggerFactory.getLogger(GecorRepositorio.class);

    public record Usuario(String keycloakId, String nombre, String correo,
                          Integer rolId, String rolCodigo, String rolNombre) {}

    public record Rol(int id, String codigo, String nombre) {}

    public record Secretaria(String codigo, String nombre) {}

    /** Fila del listado de administracion: incluye el rol y el ultimo ingreso calculado. */
    public record UsuarioListado(String keycloakId, String nombre, String correo, boolean activo,
                                 String rolCodigo, String rolNombre,
                                 java.time.OffsetDateTime ultimoIngreso) {}

    public record RolListado(int id, String codigo, String nombre, String ambito, boolean activo) {}

    public record PermisoListado(int id, String codigo, String nombre,
                                 String modulo, String moduloNombre, boolean activo, boolean moduloActivo) {}

    private final GecorDatabase database;

    public GecorRepositorio(GecorDatabase database) {
        this.database = database;
    }

    /** El usuario con su rol ya resuelto: una sola consulta en vez de ir a buscar el nombre aparte. */
    public Optional<Usuario> usuario(String keycloakId) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Optional.empty();
        }
        List<Usuario> filas = jdbc.query("""
                SELECT u.keycloak_id, u.nombre, u.correo, r.id, r.codigo, r.nombre
                FROM gecor.usuario u
                LEFT JOIN gecor.rol r ON r.id = u.rol_id
                WHERE u.keycloak_id = ?
                """,
                (rs, i) -> new Usuario(rs.getString(1), rs.getString(2), rs.getString(3),
                        (Integer) rs.getObject(4), rs.getString(5), rs.getString(6)),
                keycloakId);
        return filas.stream().findFirst();
    }

    /** Alta o refresco del usuario que entra: el nombre y el correo son los que trae el token. */
    public void guardarUsuario(String keycloakId, String nombre, String correo) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return;
        }
        jdbc.update("""
                INSERT INTO gecor.usuario (keycloak_id, nombre, correo)
                VALUES (?, ?, ?)
                ON CONFLICT (keycloak_id) DO UPDATE
                    SET nombre = EXCLUDED.nombre,
                        correo = EXCLUDED.correo
                """, keycloakId, nombre, correo);
    }

    public void registrarIngreso(String keycloakId, String origen) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return;
        }
        jdbc.update("INSERT INTO gecor.ingreso (keycloak_id, origen) VALUES (?, ?)", keycloakId, origen);
    }

    /** De los roles que trae el token, cuales existen en GECOR. Los demas se ignoran. */
    public List<Rol> rolesExistentes(Collection<String> codigos) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null || codigos.isEmpty()) {
            return List.of();
        }
        List<String> pedidos = codigos.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        if (pedidos.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", pedidos.stream().map(c -> "?").toList());
        return jdbc.query(
                "SELECT id, codigo, nombre FROM gecor.rol WHERE activo AND codigo IN (" + placeholders + ")",
                (rs, i) -> new Rol(rs.getInt(1), rs.getString(2), rs.getString(3)),
                pedidos.toArray());
    }

    public Set<String> permisosDeRol(int rolId) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Set.of();
        }
        return new LinkedHashSet<>(jdbc.queryForList("""
                SELECT p.codigo
                FROM gecor.rol_permiso rp
                JOIN gecor.permiso p ON p.id = rp.permiso_id
                JOIN gecor.modulo m ON m.id = p.modulo_id
                WHERE rp.rol_id = ? AND p.activo AND m.activo
                """, String.class, rolId));
    }

    /** Permisos sueltos del usuario: concedidos (permitir) o revocados (no permitir). */
    public Map<String, Boolean> permisosDirectos(String keycloakId) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Map.of();
        }
        Map<String, Boolean> permisos = new java.util.LinkedHashMap<>();
        jdbc.query("""
                SELECT p.codigo, up.permitir
                FROM gecor.usuario_permiso up
                JOIN gecor.permiso p ON p.id = up.permiso_id
                JOIN gecor.modulo m ON m.id = p.modulo_id
                WHERE up.keycloak_id = ? AND p.activo AND m.activo
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            permisos.put(rs.getString(1), rs.getBoolean(2));
        }, keycloakId);
        return permisos;
    }

    public Set<String> secretariasDelUsuario(String keycloakId) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Set.of();
        }
        return new LinkedHashSet<>(jdbc.queryForList("""
                SELECT s.codigo
                FROM gecor.usuario_secretaria us
                JOIN gecor.secretaria s ON s.id = us.secretaria_id
                WHERE us.keycloak_id = ? AND s.activo
                """, String.class, keycloakId));
    }

    public Set<String> secretariasDeRol(int rolId) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Set.of();
        }
        return new LinkedHashSet<>(jdbc.queryForList("""
                SELECT s.codigo
                FROM gecor.rol_secretaria rs
                JOIN gecor.secretaria s ON s.id = rs.secretaria_id
                WHERE rs.rol_id = ? AND s.activo
                """, String.class, rolId));
    }

    public List<Secretaria> secretarias() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return List.of();
        }
        return jdbc.query("SELECT codigo, nombre FROM gecor.secretaria WHERE activo ORDER BY nombre",
                (rs, i) -> new Secretaria(rs.getString(1), rs.getString(2)));
    }

    /** Catalogo de secretarias: codigo normalizado para cruzar con los contratos, nombre para mostrar. */
    public void registrarSecretarias(Collection<Secretaria> secretarias) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null || secretarias.isEmpty()) {
            return;
        }
        for (Secretaria secretaria : secretarias) {
            if (secretaria.codigo() == null || secretaria.codigo().isBlank()) {
                continue;
            }
            try {
                jdbc.update("""
                        INSERT INTO gecor.secretaria (codigo, nombre)
                        VALUES (?, ?)
                        ON CONFLICT (codigo) DO NOTHING
                        """, secretaria.codigo(), secretaria.nombre());
            } catch (Exception e) {
                log.warn("No se pudo registrar la secretaria {}: {}", secretaria.codigo(), e.getMessage());
            }
        }
    }

    // ------------------------------------------------------------------
    // Administracion de accesos: listados y cambios desde la pantalla de
    // configuracion. Los cambios de permisos se aplican sobre el usuario,
    // sin tocar su rol, para permitir excepciones puntuales.
    // ------------------------------------------------------------------

    public List<UsuarioListado> usuarios() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return List.of();
        }
        return jdbc.query("""
                SELECT keycloak_id, nombre, correo, activo, rol_codigo, rol_nombre, ultimo_ingreso
                FROM gecor.v_usuario
                ORDER BY nombre
                """,
                (rs, i) -> new UsuarioListado(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getBoolean(4),
                        rs.getString(5), rs.getString(6),
                        rs.getObject(7, java.time.OffsetDateTime.class)));
    }

    /** Permisos sueltos de todos los usuarios, agrupados por keycloak_id. */
    public Map<String, Map<String, Boolean>> permisosDirectosTodos() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Map.of();
        }
        Map<String, Map<String, Boolean>> permisos = new java.util.LinkedHashMap<>();
        jdbc.query("""
                SELECT up.keycloak_id, p.codigo, up.permitir
                FROM gecor.usuario_permiso up
                JOIN gecor.permiso p ON p.id = up.permiso_id
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            permisos.computeIfAbsent(rs.getString(1), k -> new java.util.LinkedHashMap<>())
                    .put(rs.getString(2), rs.getBoolean(3));
        });
        return permisos;
    }

    public List<RolListado> roles() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return List.of();
        }
        return jdbc.query("""
                SELECT id, codigo, nombre, ambito, activo
                FROM gecor.rol
                ORDER BY codigo
                """,
                (rs, i) -> new RolListado(rs.getInt(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getBoolean(5)));
    }

    /** Cuantos usuarios tiene asignado cada rol, para el listado de roles. */
    public Map<Integer, Long> usuariosPorRol() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return Map.of();
        }
        Map<Integer, Long> conteo = new java.util.LinkedHashMap<>();
        jdbc.query("""
                SELECT rol_id, count(*)
                FROM gecor.usuario
                WHERE rol_id IS NOT NULL
                GROUP BY rol_id
                """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            conteo.put(rs.getInt(1), rs.getLong(2));
        });
        return conteo;
    }

    public List<PermisoListado> permisos() {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return List.of();
        }
        return jdbc.query("""
                SELECT p.id, p.codigo, p.nombre, m.codigo, m.nombre, p.activo, m.activo
                FROM gecor.permiso p
                JOIN gecor.modulo m ON m.id = p.modulo_id
                ORDER BY m.nombre, p.nombre
                """,
                (rs, i) -> new PermisoListado(rs.getInt(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getBoolean(6), rs.getBoolean(7)));
    }

    public boolean definirModuloActivo(String codigo, boolean activo) {
        JdbcTemplate jdbc = database.jdbc();
        return jdbc != null && jdbc.update("UPDATE gecor.modulo SET activo = ? WHERE codigo = ?", activo, codigo) > 0;
    }

    public boolean existeRol(String codigo) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null || codigo == null || codigo.isBlank()) {
            return false;
        }
        Integer total = jdbc.queryForObject("SELECT count(*) FROM gecor.rol WHERE codigo = ?",
                Integer.class, codigo);
        return total != null && total > 0;
    }

    public boolean existePermiso(String codigo) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null || codigo == null || codigo.isBlank()) {
            return false;
        }
        Integer total = jdbc.queryForObject("SELECT count(*) FROM gecor.permiso WHERE codigo = ?",
                Integer.class, codigo);
        return total != null && total > 0;
    }

    /** Cambia el rol de una persona. Un codigo null deja el usuario sin rol. */
    public boolean cambiarRol(String keycloakId, String rolCodigo) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return false;
        }
        if (rolCodigo == null) {
            return jdbc.update("UPDATE gecor.usuario SET rol_id = NULL WHERE keycloak_id = ?",
                    keycloakId) > 0;
        }
        return jdbc.update("""
                UPDATE gecor.usuario
                SET rol_id = (SELECT id FROM gecor.rol WHERE codigo = ?)
                WHERE keycloak_id = ?
                """, rolCodigo, keycloakId) > 0;
    }

    /**
     * Permiso granular de una persona: true concede, false deniega y null vuelve
     * a heredar del rol (se borra la excepcion).
     */
    public boolean definirPermiso(String keycloakId, String permisoCodigo, Boolean permitir) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return false;
        }
        if (permitir == null) {
            return jdbc.update("""
                    DELETE FROM gecor.usuario_permiso
                    WHERE keycloak_id = ?
                      AND permiso_id = (SELECT id FROM gecor.permiso WHERE codigo = ?)
                    """, keycloakId, permisoCodigo) > 0;
        }
        return jdbc.update("""
                INSERT INTO gecor.usuario_permiso (keycloak_id, permiso_id, permitir)
                SELECT ?, id, ? FROM gecor.permiso WHERE codigo = ?
                ON CONFLICT (keycloak_id, permiso_id) DO UPDATE SET permitir = EXCLUDED.permitir
                """, keycloakId, permitir, permisoCodigo) > 0;
    }

    /** Promueve a un usuario al rol indicado solo si todavia no tiene ninguno. */
    public void asignarRolSiFalta(String keycloakId, String rolCodigo) {
        JdbcTemplate jdbc = database.jdbc();
        if (jdbc == null) {
            return;
        }
        jdbc.update("""
                UPDATE gecor.usuario
                SET rol_id = (SELECT id FROM gecor.rol WHERE codigo = ?)
                WHERE keycloak_id = ? AND rol_id IS NULL
                """, rolCodigo, keycloakId);
    }
}
