package com.sgcc.seguimientocuentas.accesos.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Ajustes de la base GECOR, donde viven los usuarios, los roles y los permisos granulares.
 *
 * Con <code>gecor.enabled=false</code> el modulo no abre ninguna conexion y todos los usuarios
 * autenticados quedan con alcance completo: es el modo en que se puede desplegar sin la base
 * de permisos. Con <code>gecor.enabled=true</code> la base es la que manda.
 */
@ConfigurationProperties(prefix = "gecor")
public class GecorProperties {

    private boolean enabled;
    private String url;
    private String username;
    private String password;
    private int poolSize = 5;
    private long ttlSesionSegundos = 60;
    private boolean crearBase = true;
    private java.util.List<String> adminCorreos = java.util.List.of();
    private java.util.List<String> adminNombres = java.util.List.of();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public int getPoolSize() {
        return poolSize;
    }

    public void setPoolSize(int poolSize) {
        this.poolSize = poolSize;
    }

    public long getTtlSesionSegundos() {
        return ttlSesionSegundos;
    }

    public void setTtlSesionSegundos(long ttlSesionSegundos) {
        this.ttlSesionSegundos = ttlSesionSegundos;
    }

    public boolean configurada() {
        return enabled && url != null && !url.isBlank();
    }

    public boolean isCrearBase() {
        return crearBase;
    }

    /** Crear la base si falta exige que el usuario tenga el privilegio CREATEDB en el servidor. */
    public void setCrearBase(boolean crearBase) {
        this.crearBase = crearBase;
    }

    public java.util.List<String> getAdminCorreos() {
        return adminCorreos;
    }

    public void setAdminCorreos(java.util.List<String> adminCorreos) {
        this.adminCorreos = adminCorreos == null ? java.util.List.of() : adminCorreos;
    }

    public java.util.List<String> getAdminNombres() {
        return adminNombres;
    }

    public void setAdminNombres(java.util.List<String> adminNombres) {
        this.adminNombres = adminNombres == null ? java.util.List.of() : adminNombres;
    }
}
