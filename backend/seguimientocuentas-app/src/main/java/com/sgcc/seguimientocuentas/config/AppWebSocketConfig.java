package com.sgcc.seguimientocuentas.config;

import com.sgcc.seguimientocuentas.cdc.adapter.in.CDCWebSocketHandler;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class AppWebSocketConfig implements WebSocketConfigurer {

    private final CDCWebSocketHandler cdcWebSocketHandler;
    private final KeycloakTokenHandshakeInterceptor tokenHandshakeInterceptor;

    public AppWebSocketConfig(CDCWebSocketHandler cdcWebSocketHandler,
                              @Value("${auth.enabled:true}") boolean authEnabled,
                              ObjectProvider<JwtDecoder> jwtDecoder) {
        this.cdcWebSocketHandler = cdcWebSocketHandler;
        // Se construye aqui (y no como @Bean en esta misma clase) para no crear un
        // ciclo: la configuracion necesita al interceptor para instanciarse.
        this.tokenHandshakeInterceptor = new KeycloakTokenHandshakeInterceptor(authEnabled, jwtDecoder);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(cdcWebSocketHandler, "/ws/cdc")
                .setAllowedOriginPatterns("*")
                .addInterceptors(tokenHandshakeInterceptor);
    }
}
