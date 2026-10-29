package com.sgcc.seguimientocuentas.contratos.adapter.in;

import com.sgcc.seguimientocuentas.contratos.application.ContratoApplicationService;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenCache;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/contratos")
public class ContratoController {

    private final ContratoApplicationService contratoApplicationService;
    private final ContratoResumenCache resumenCache;

    public ContratoController(ContratoApplicationService contratoApplicationService,
                              ContratoResumenCache resumenCache) {
        this.contratoApplicationService = contratoApplicationService;
        this.resumenCache = resumenCache;
    }

    @GetMapping
    public ResponseEntity<byte[]> listarTodos(
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        ContratoResumenCache.Snapshot snapshot = resumenCache.obtener();
        CacheControl cacheControl = CacheControl.maxAge(Duration.ofSeconds(30))
                .cachePublic()
                .staleWhileRevalidate(Duration.ofSeconds(120));

        if (coincide(ifNoneMatch, snapshot.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(snapshot.etag())
                    .cacheControl(cacheControl)
                    .build();
        }

        return ResponseEntity.ok()
                .eTag(snapshot.etag())
                .cacheControl(cacheControl)
                .contentType(MediaType.APPLICATION_JSON)
                .body(snapshot.body());
    }

    @GetMapping("/{noContrato}")
    public String verProgreso(@PathVariable String noContrato) {
        return contratoApplicationService.obtenerProgreso(noContrato);
    }

    private static boolean coincide(String ifNoneMatch, String etag) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank()) {
            return false;
        }
        if ("*".equals(ifNoneMatch.trim())) {
            return true;
        }
        for (String candidato : ifNoneMatch.split(",")) {
            String normalizado = quitarDebil(candidato.trim());
            if (normalizado.equals(etag) || normalizado.equals(quitarDebil(etag))) {
                return true;
            }
        }
        return false;
    }

    private static String quitarDebil(String valor) {
        return valor.startsWith("W/") ? valor.substring(2) : valor;
    }
}
