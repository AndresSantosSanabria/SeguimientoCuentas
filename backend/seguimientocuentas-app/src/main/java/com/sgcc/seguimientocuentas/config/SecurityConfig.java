package com.sgcc.seguimientocuentas.config;

import java.io.IOException;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationEntryPoint;
import org.springframework.security.web.firewall.StrictHttpFirewall;

/**
 * Seguridad de la API.
 *
 * Con <code>auth.enabled=true</code> la API es un OAuth2 Resource Server: cada
 * petición debe traer <code>Authorization: Bearer &lt;JWT de Keycloak&gt;</code>,
 * que se valida contra las claves públicas del realm (JWKS). Es el mismo patrón
 * que usa Proyecta.
 *
 * Con <code>auth.enabled=false</code> se conserva el comportamiento anterior
 * (todo abierto) para poder desplegar sin identidad de forma controlada.
 *
 * Notas:
 * - API stateless: no hay cookies de sesión, por lo que CSRF no aplica
 *   (el atacante no puede hacer que el navegador adjunte credenciales).
 * - <code>/healthz</code> queda abierto para los healthchecks de Docker.
 * - <code>/ws/**</code> queda abierto en la cadena porque el navegador no puede
 *   mandar cabeceras Authorization en un WebSocket: el token viaja como query
 *   <code>?token=</code> y se valida en el handshake (KeycloakTokenHandshakeInterceptor).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final boolean authEnabled;
    private final ObjectProvider<JwtDecoder> jwtDecoder;

    public SecurityConfig(@Value("${auth.enabled:true}") boolean authEnabled,
                          ObjectProvider<JwtDecoder> jwtDecoder) {
        this.authEnabled = authEnabled;
        this.jwtDecoder = jwtDecoder;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                auth.requestMatchers("/healthz", "/error").permitAll();
                auth.requestMatchers("/ws/**").permitAll();
                // API siempre cerrada: si auth está apagado no hay identidad confiable y se deniega.
                auth.requestMatchers("/api/**").authenticated();
                auth.anyRequest().permitAll();
            });

        if (authEnabled) {
            JwtDecoder decoder = jwtDecoder.getIfAvailable();
            if (decoder == null) {
                throw new IllegalStateException(
                    "auth.enabled=true pero no hay JwtDecoder: define KEYCLOAK_ISSUER_URI y KEYCLOAK_JWKS_URI en .env");
            }
            http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.decoder(decoder))
                .authenticationEntryPoint(new JsonUnauthorizedEntryPoint()));
        }

        return http.build();
    }

    /**
     * Segunda puerta del %2F de los numeros de contrato. Con passthrough (en AppTomcatConfig) el
     * servletPath conserva el %2F sin decodificar, asi que hay que quitar tanto el bloqueo del slash
     * codificado como el del '%' literal, que es la regla anti doble-codificacion.
     */
    @Bean
    public WebSecurityCustomizer firewallNumerosDeContrato() {
        StrictHttpFirewall firewall = new StrictHttpFirewall();
        firewall.setAllowUrlEncodedSlash(true);
        firewall.setAllowUrlEncodedPercent(true);
        return web -> web.httpFirewall(firewall);
    }

    /** 401 en JSON: el frontend distingue "sesion vencida" de un error del servidor. */
    static class JsonUnauthorizedEntryPoint extends BasicAuthenticationEntryPoint {

        @Override
        public void commence(jakarta.servlet.http.HttpServletRequest request,
                             jakarta.servlet.http.HttpServletResponse response,
                             AuthenticationException authException) throws IOException {
            response.setHeader("WWW-Authenticate", "Bearer");
            response.setStatus(401);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"unauthorized\",\"message\":\"Token ausente, vencido o invalido.\"}");
        }

        @Override
        public String getRealmName() {
            return "ge-cor";
        }
    }
}
