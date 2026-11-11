package com.sgcc.seguimientocuentas.config;

import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/**
 * Valida el token de Keycloak en el handshake del WebSocket CDC.
 *
 * El navegador no permite mandar cabeceras Authorization en un WebSocket, asi que
 * el token viaja como query param <code>?token=...</code>. El interceptor lo decodifica
 * (firma + expiracion + issuer) y rechaza la conexion con 401 si no es valido,
 * igual que hace la API con las peticiones HTTP.
 */
public class KeycloakTokenHandshakeInterceptor implements HandshakeInterceptor {

    private final boolean authEnabled;
    private final ObjectProvider<JwtDecoder> jwtDecoder;

    public KeycloakTokenHandshakeInterceptor(@Value("${auth.enabled:true}") boolean authEnabled,
                                             ObjectProvider<JwtDecoder> jwtDecoder) {
        this.authEnabled = authEnabled;
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (!authEnabled) {
            return true;
        }
        JwtDecoder decoder = jwtDecoder.getIfAvailable();
        String token = tokenFromQuery(request);
        if (decoder == null || token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            Jwt jwt = decoder.decode(token);
            attributes.put("jwt", jwt);
            return true;
        }
        catch (Exception ex) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No aplica: el ciclo de vida lo maneja CDCWebSocketHandler.
    }

    private static String tokenFromQuery(ServerHttpRequest request) {
        String query = request.getURI().getRawQuery();
        if (query == null || query.isEmpty()) {
            return null;
        }
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator > 0 && "token".equals(pair.substring(0, separator))) {
                return java.net.URLDecoder.decode(pair.substring(separator + 1), java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
