package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.accesos.application.SecretariasUsuarioResolver;

/**
 * Catálogo de usuarios de la plataforma, usado para ponerle nombre al supervisor de cada contrato.
 */
@Repository
public class SupervisorJdbcRepository implements SecretariasUsuarioResolver {

    private record CacheEntry<T>(long loadedAt, T value) {}
    private static final long AMBITO_CACHE_MS = 30_000;

    private final JdbcTemplate jdbc;
    private final ConcurrentMap<String, CacheEntry<Set<String>>> secretariasCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CacheEntry<Set<String>>> contratosCache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, CacheEntry<Long>> idCache = new ConcurrentHashMap<>();

    public SupervisorJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<Long, String> nombresPorId() {
        Map<Long, String> nombres = new HashMap<>();
        jdbc.query(
                "SELECT id, nombre FROM public.t_usuarios WHERE nombre IS NOT NULL",
                (RowCallbackHandler) rs -> nombres.put(rs.getLong("id"), rs.getString("nombre").trim()));
        return nombres;
    }

    public Long idPorCorreo(String correo) {
        if (correo == null || correo.isBlank()) return null;
        String clave = correo.trim().toLowerCase(java.util.Locale.ROOT);
        CacheEntry<Long> cache = idCache.get(clave);
        if (cache != null && System.currentTimeMillis() - cache.loadedAt() < AMBITO_CACHE_MS) return cache.value();
        Long id = jdbc.query("SELECT id FROM public.t_usuarios WHERE lower(btrim(e_mail)) = lower(btrim(?))",
                rs -> rs.next() ? rs.getLong(1) : null, correo);
        if (id != null) idCache.put(clave, new CacheEntry<>(System.currentTimeMillis(), id));
        return id;
    }

    /**
     * Secretarías que se pueden inferir en solo lectura: usuario supervisor -> supervisiones ->
     * contrato -> dependencia. SupervisA conserva la fuente de verdad; esta consulta no escribe.
     */
    @Override
    public Set<String> secretariasPorCorreo(String correo) {
        if (correo == null || correo.isBlank()) {
            return Set.of();
        }
        String clave = correo.trim().toLowerCase(java.util.Locale.ROOT);
        CacheEntry<Set<String>> cache = secretariasCache.get(clave);
        if (cache != null && System.currentTimeMillis() - cache.loadedAt() < AMBITO_CACHE_MS) return cache.value();
        Set<String> encontradas = new LinkedHashSet<>();
        jdbc.query("""
                SELECT DISTINCT c.dependencia
                FROM public.t_usuarios u
                JOIN contratacion.ct_t_supervision s ON s.id_supervisor = u.id
                JOIN contratacion.ct_t_contrato_sap c ON c.no_contrato = s.no_contrato
                WHERE lower(btrim(u.e_mail)) = lower(btrim(?))
                  AND c.dependencia IS NOT NULL
                  AND btrim(c.dependencia) <> ''
                UNION
                SELECT DISTINCT c.dependencia
                FROM public.t_usuarios u
                JOIN contratacion.ct_t_contrato_sap c
                  ON regexp_replace(upper(btrim(c.contratista)), '[^A-Z0-9]', '', 'g')
                   LIKE '%' || regexp_replace(upper(btrim(u.nombre)), '[^A-Z0-9]', '', 'g') || '%'
                WHERE lower(btrim(u.e_mail)) = lower(btrim(?))
                  AND c.dependencia IS NOT NULL
                  AND btrim(coalesce(u.nombre, '')) <> ''
                """, (RowCallbackHandler) rs -> {
                    encontradas.add(AmbitoUsuario.normalizar(rs.getString(1)));
                }, correo, correo);
        encontradas.remove(null);
        // Si el historial apunta a varias secretarías, no se adivina una ni se amplía el alcance.
        Set<String> resultado = encontradas.size() == 1 ? Set.copyOf(encontradas) : Set.of();
        secretariasCache.put(clave, new CacheEntry<>(System.currentTimeMillis(), resultado));
        return resultado;
    }

    /** Contratos vinculados al correo autenticado: correo SupervisA -> usuario -> nombre contratista. */
    public Set<String> contratosPorCorreo(String correo) {
        if (correo == null || correo.isBlank()) {
            return Set.of();
        }
        String clave = correo.trim().toLowerCase(java.util.Locale.ROOT);
        CacheEntry<Set<String>> cache = contratosCache.get(clave);
        if (cache != null && System.currentTimeMillis() - cache.loadedAt() < AMBITO_CACHE_MS) return cache.value();
        Set<String> contratos = new LinkedHashSet<>();
        jdbc.query("""
                SELECT DISTINCT c.no_contrato
                FROM public.t_usuarios u
                JOIN contratacion.ct_t_contrato_sap c
                  ON regexp_replace(upper(btrim(c.contratista)), '[^A-Z0-9]', '', 'g')
                   LIKE '%' || regexp_replace(upper(btrim(u.nombre)), '[^A-Z0-9]', '', 'g') || '%'
                WHERE lower(btrim(u.e_mail)) = lower(btrim(?))
                  AND c.no_contrato IS NOT NULL
                  AND btrim(coalesce(u.nombre, '')) <> ''
                """, (RowCallbackHandler) rs -> contratos.add(rs.getString(1)), correo);
        Set<String> resultado = Set.copyOf(contratos);
        contratosCache.put(clave, new CacheEntry<>(System.currentTimeMillis(), resultado));
        return resultado;
    }
}
