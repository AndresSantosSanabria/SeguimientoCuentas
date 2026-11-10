package com.sgcc.seguimientocuentas.config;

import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Configuration;

/**
 * 2.858 numeros de contrato llevan '/' y viajan como %2F. Tomcat lo rechaza con 400 antes de llegar
 * al servlet; passthrough lo deja codificado para que Spring lo decodifique dentro del @PathVariable.
 * El valor solo se usa como clave de consulta, nunca como ruta de fichero.
 */
@Configuration
public class AppTomcatConfig implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    @Override
    public void customize(TomcatServletWebServerFactory factory) {
        factory.addConnectorCustomizers(connector -> connector.setEncodedSolidusHandling("passthrough"));
    }
}