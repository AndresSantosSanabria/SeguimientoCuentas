package com.sgcc.seguimientocuentas.config;

import com.sgcc.seguimientocuentas.accesos.adapter.out.jpa.GecorRepositorio;
import com.sgcc.seguimientocuentas.accesos.config.GecorProperties;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTContratoSapRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Arma el catalogo de secretarias de GECOR con las dependencias que existen en los contratos.
 *
 * Asi la secretaria de cada persona se puede asignar con el mismo texto que ve en pantalla, sin
 * que alguien tenga que escribir el codigo a mano. Las asignaciones que haga un administrador
 * despues no se tocan: aqui solo se crean las que faltan.
 */
@Component
public class SecretariasCatalogoSync {

    private static final Logger log = LoggerFactory.getLogger(SecretariasCatalogoSync.class);

    private final CtTContratoSapRepository contratos;
    private final GecorRepositorio repositorio;
    private final GecorProperties properties;

    public SecretariasCatalogoSync(CtTContratoSapRepository contratos,
                                   GecorRepositorio repositorio,
                                   GecorProperties properties) {
        this.contratos = contratos;
        this.repositorio = repositorio;
        this.properties = properties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void sincronizar() {
        if (!properties.configurada()) {
            return;
        }
        try {
            // El codigo normalizado cruza con los contratos; el nombre original es el que se muestra.
            Map<String, GecorRepositorio.Secretaria> catalogo = new LinkedHashMap<>();
            for (String dependencia : contratos.findDependenciasDistintas()) {
                String codigo = AmbitoUsuario.normalizar(dependencia);
                if (codigo != null) {
                    catalogo.putIfAbsent(codigo, new GecorRepositorio.Secretaria(codigo, dependencia));
                }
            }
            repositorio.registrarSecretarias(catalogo.values());
            log.info("Catalogo de secretarias en GECOR: {}", catalogo.size());
        } catch (Exception e) {
            log.warn("No se pudo sincronizar el catalogo de secretarias: {}", e.getMessage());
        }
    }
}
