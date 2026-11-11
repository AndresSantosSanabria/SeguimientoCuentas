package com.sgcc.seguimientocuentas.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Decodificador de los JWT de Keycloak.
 *
 * Se usa el conjunto de claves publicas (JWKS) del realm en lugar del descubrimiento
 * automatico para que el arranque NO dependa de la red de Keycloak: si el IAM esta
 * caido la API arranca y falla solo al validar tokens, con un 401 claro.
 *
 * Ademas de la firma se validan:
 *  - <b>expiracion</b> (JwtTimestampValidator, incluido en createDefaultWithIssuer)
 *  - <b>issuer</b>: el token debe venir de ESTE realm, no de otro.
 */
@Configuration
public class KeycloakJwtDecoderConfig {

    @Bean
    @ConditionalOnProperty(name = "auth.enabled", havingValue = "true", matchIfMissing = true)
    public JwtDecoder keycloakJwtDecoder(@Value("${keycloak.issuer-uri:}") String issuerUri,
                                         @Value("${keycloak.jwks-uri:}") String jwksUri) {
        if (issuerUri == null || issuerUri.isBlank()) {
            throw new IllegalStateException(
                "auth.enabled=true pero falta keycloak.issuer-uri: define KEYCLOAK_ISSUER_URI en .env");
        }
        if (jwksUri == null || jwksUri.isBlank()) {
            // Fallback: descubrimiento OIDC (requiere red en el arranque).
            return JwtDecoders.fromIssuerLocation(issuerUri);
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuerUri)));
        return decoder;
    }
}
