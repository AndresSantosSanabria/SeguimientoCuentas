package com.sgcc.seguimientocuentas.accesos.domain.model;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/**
 * Lo que el sistema sabe de la persona que esta conectada: su rol, sus permisos y las secretarias
 * que puede ver. Es la unica fuente que decide si un contrato se muestra.
 *
 * El alcance se arma asi, en este orden:
 * <ol>
 *   <li>el rol asignado explícitamente en GECOR; el token nunca asigna permisos</li>
 *   <li>los permisos del rol, mas los permisos sueltos que se le haber denied o concedido</li>
 *   <li>las secretarias asignadas directamente en GECOR o al rol</li>
 * </ol>
 */
public record AmbitoUsuario(
        String keycloakId,
        String nombre,
        String correo,
        String rolCodigo,
        String rolNombre,
        Set<String> roles,
        Set<String> permisos,
        Set<String> secretarias,
        boolean verTodasSecretarias) {

    public static final String PERMISO_VER_TODAS = "CONTRATOS_VER_TODOS";

    public AmbitoUsuario {
        roles = Set.copyOf(roles);
        permisos = Set.copyOf(permisos);
        secretarias = Set.copyOf(secretarias);
    }

    /** Alcance de quien no tiene nada registrado: no ve ningun contrato. */
    public static AmbitoUsuario sinAlcance(String keycloakId, String nombre, String correo) {
        return new AmbitoUsuario(keycloakId, nombre, correo, null, null,
                Set.of(), Set.of(), Set.of(), false);
    }

    /** Alcance de cuando la base de permisos esta apagada: entra todo, como antes de existir GECOR. */
    public static AmbitoUsuario sinRestricciones(String keycloakId, String nombre, String correo) {
        return new AmbitoUsuario(keycloakId, nombre, correo, null, null,
                Set.of(), Set.of("*"), Set.of(), true);
    }

    public boolean puede(String permiso) {
        return permisos.contains("*") || permisos.contains(permiso);
    }

    public AmbitoUsuario conSecretarias(Set<String> adicionales) {
        Set<String> alcance = new java.util.LinkedHashSet<>(secretarias);
        if (adicionales != null) {
            adicionales.stream().map(AmbitoUsuario::normalizar).filter(java.util.Objects::nonNull)
                    .forEach(alcance::add);
        }
        return new AmbitoUsuario(keycloakId, nombre, correo, rolCodigo, rolNombre, roles,
                permisos, alcance, verTodasSecretarias);
    }

    /** La secretaria del contrato se compara con el codigo de la secretaria, sin tildes ni mayusculas. */
    public boolean veSecretaria(String dependencia) {
        if (verTodasSecretarias) {
            return true;
        }
        String codigo = normalizar(dependencia);
        return codigo != null && secretarias.contains(codigo);
    }

    /** BASICO se restringe a los contratos cuyo contratista corresponde al nombre del perfil. */
    public boolean veContrato(String contratista, String dependencia) {
        if ("ADMIN".equals(rolCodigo)) {
            return true;
        }
        if ("ENLACE".equals(rolCodigo)) {
            return veSecretaria(dependencia);
        }
        if (!"BASICO".equals(rolCodigo) || nombre == null || contratista == null) {
            return false;
        }
        String identidad = normalizar(nombre);
        if (identidad == null) {
            return false;
        }
        Set<String> tokens = java.util.Arrays.stream(identidad.split("[^A-Z0-9]+"))
                .filter(token -> token.length() > 1).collect(java.util.stream.Collectors.toSet());
        String destino = normalizar(contratista);
        return !tokens.isEmpty() && tokens.stream().allMatch(destino::contains);
    }

    /** Sin tildes y en mayusculas: asi "Secretaría de Salud" y "SECRETARIA DE SALUD" son la misma. */
    public static String normalizar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpio = valor.trim().toUpperCase(Locale.ROOT);
        if (limpio.isEmpty()) {
            return null;
        }
        String sinTilde = Normalizer.normalize(limpio, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return sinTilde.isEmpty() ? null : sinTilde;
    }
}
