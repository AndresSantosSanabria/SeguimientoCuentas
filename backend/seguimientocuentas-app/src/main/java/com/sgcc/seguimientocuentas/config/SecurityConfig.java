package com.sgcc.seguimientocuentas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.firewall.StrictHttpFirewall;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/**").permitAll()
                .anyRequest().permitAll()
            );
        return http.build();
    }

    /**
     * Segunda puerta del %2F de los numeros de contrato. Con passthrough (ver AppTomcatConfig) el
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
}
