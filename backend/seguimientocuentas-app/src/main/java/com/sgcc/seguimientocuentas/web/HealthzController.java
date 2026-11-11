package com.sgcc.seguimientocuentas.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Healthcheck liviano para los probes de Docker/Kubernetes.
 * Queda fuera de /api/** y sin autenticacion para que el contenedor pueda
 * comprobar el proceso aunque nadie tenga token.
 */
@RestController
public class HealthzController {

    @GetMapping("/healthz")
    public Map<String, String> healthz() {
        return Map.of("status", "UP");
    }
}
