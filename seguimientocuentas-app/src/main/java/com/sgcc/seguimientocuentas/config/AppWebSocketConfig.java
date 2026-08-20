package com.sgcc.seguimientocuentas.config;

import com.sgcc.seguimientocuentas.cdc.adapter.in.CDCWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class AppWebSocketConfig implements WebSocketConfigurer {

    private final CDCWebSocketHandler cdcWebSocketHandler;

    public AppWebSocketConfig(CDCWebSocketHandler cdcWebSocketHandler) {
        this.cdcWebSocketHandler = cdcWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(cdcWebSocketHandler, "/ws/cdc")
                .setAllowedOriginPatterns("*");
    }
}
