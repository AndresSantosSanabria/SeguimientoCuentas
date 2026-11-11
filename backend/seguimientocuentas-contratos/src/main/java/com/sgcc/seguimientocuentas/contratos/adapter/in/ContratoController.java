package com.sgcc.seguimientocuentas.contratos.adapter.in;

import com.sgcc.seguimientocuentas.accesos.application.SesionService;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.contratos.application.ContratoApplicationService;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenCache;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisorJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenIndex;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Set;
import java.util.List;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/contratos")
public class ContratoController {

    private final ContratoApplicationService contratoApplicationService;
    private final ContratoResumenCache resumenCache;
    private final SesionService sesionService;
    private final SupervisorJdbcRepository supervisorRepository;
    private final ContratoResumenIndex indice;

    public ContratoController(ContratoApplicationService contratoApplicationService,
                              ContratoResumenCache resumenCache,
                              SesionService sesionService,
                              SupervisorJdbcRepository supervisorRepository,
                              ContratoResumenIndex indice) {
        this.contratoApplicationService = contratoApplicationService;
        this.resumenCache = resumenCache;
        this.sesionService = sesionService;
        this.supervisorRepository = supervisorRepository;
        this.indice = indice;
    }

    /**
     * La lista de contratos, recortada a las secretarias que puede ver quien pregunta.
     * Quien tiene el permiso de ver todas recibe la lista completa, que es la misma para todos.
     */
    @GetMapping
    public ResponseEntity<byte[]> listarTodos(
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch,
            @RequestHeader(value = HttpHeaders.ACCEPT_ENCODING, required = false) String acceptEncoding) {
        AmbitoUsuario ambito = alcanceActual();

        if (!ambito.puede("CONTRATOS_VER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if ("BASICO".equals(ambito.rolCodigo()) && !ambito.verTodasSecretarias()) {
            Set<String> contratosPermitidos = supervisorRepository.contratosPorCorreo(ambito.correo());
            ContratoResumenCache.SnapshotUsuario snapshot = resumenCache.obtenerUsuario(contratosPermitidos);
            CacheControl cacheControl = CacheControl.noStore().cachePrivate();
            if (coincide(ifNoneMatch, snapshot.etag())) {
                return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(snapshot.etag())
                        .cacheControl(cacheControl).build();
            }
            ResponseEntity.BodyBuilder respuesta = ResponseEntity.ok().eTag(snapshot.etag())
                    .cacheControl(cacheControl).contentType(MediaType.APPLICATION_JSON);
            return aceptaGzip(acceptEncoding)
                    ? respuesta.header(HttpHeaders.CONTENT_ENCODING, "gzip").body(snapshot.bodyGzip())
                    : respuesta.body(snapshot.body());
        }

        if (ambito.verTodasSecretarias()) {
            return completa(ifNoneMatch, acceptEncoding);
        }

        Set<String> secretarias = ambito.secretarias();
        ContratoResumenCache.SnapshotSecretaria snapshot = resumenCache.obtenerSecretarias(secretarias);
        CacheControl cacheControl = CacheControl.maxAge(Duration.ofSeconds(30))
                .cachePrivate()
                .staleWhileRevalidate(Duration.ofSeconds(120));

        if (coincide(ifNoneMatch, snapshot.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(snapshot.etag())
                    .cacheControl(cacheControl)
                    .varyBy(HttpHeaders.ACCEPT_ENCODING)
                    .build();
        }

        ResponseEntity.BodyBuilder respuesta = ResponseEntity.ok()
                .eTag(snapshot.etag())
                .cacheControl(cacheControl)
                .varyBy(HttpHeaders.ACCEPT_ENCODING)
                .contentType(MediaType.APPLICATION_JSON);

        return aceptaGzip(acceptEncoding)
                ? respuesta.header(HttpHeaders.CONTENT_ENCODING, "gzip").body(snapshot.bodyGzip())
                : respuesta.body(resumenCache.cuerpoSinComprimir(secretarias));
    }

    private ResponseEntity<byte[]> completa(String ifNoneMatch, String acceptEncoding) {
        ContratoResumenCache.Snapshot snapshot = resumenCache.obtener();
        CacheControl cacheControl = CacheControl.maxAge(Duration.ofSeconds(30))
                .cachePublic()
                .staleWhileRevalidate(Duration.ofSeconds(120));

        if (coincide(ifNoneMatch, snapshot.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(snapshot.etag())
                    .cacheControl(cacheControl)
                    .varyBy(HttpHeaders.ACCEPT_ENCODING)
                    .build();
        }

        ResponseEntity.BodyBuilder respuesta = ResponseEntity.ok()
                .eTag(snapshot.etag())
                .cacheControl(cacheControl)
                .varyBy(HttpHeaders.ACCEPT_ENCODING)
                .contentType(MediaType.APPLICATION_JSON);

        return aceptaGzip(acceptEncoding)
                ? respuesta.header(HttpHeaders.CONTENT_ENCODING, "gzip").body(snapshot.bodyGzip())
                : respuesta.body(snapshot.body());
    }

    @GetMapping("/{noContrato}")
    public ResponseEntity<String> verProgreso(@PathVariable String noContrato) {
        AmbitoUsuario ambito = alcanceActual();
        if (!puedeVerContrato(noContrato, ambito)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(contratoApplicationService.obtenerProgreso(noContrato));
    }

    /** El monto se consulta y entrega solo desde la ruta de detalle del contrato. */
    @GetMapping(value = "/{noContrato}/valor", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ValorContratoDTO> verValor(@PathVariable String noContrato) {
        AmbitoUsuario ambito = alcanceActual();
        if (!puedeVerContrato(noContrato, ambito)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        BigDecimal valor = indice.valorTotal(noContrato);
        return valor == null
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(new ValorContratoDTO(noContrato, valor));
    }

    public record ValorContratoDTO(String noContrato, BigDecimal valorTotal) {}

    /** Contratos que supervisa la persona conectada, sin mezclarlos en el resumen agregado por secretaría. */
    @GetMapping("/supervisados")
    public ResponseEntity<List<ContratoResumenIndex.ContratoSupervisorDTO>> contratosSupervisados() {
        AmbitoUsuario ambito = alcanceActual();
        if (!ambito.puede("CONTRATOS_VER") || !"ENLACE".equals(ambito.rolCodigo())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(indice.contratosCruzadosDeSecretarias(ambito.secretarias()));
    }

    private boolean puedeVerContrato(String noContrato, AmbitoUsuario ambito) {
        if ("BASICO".equals(ambito.rolCodigo()) && !ambito.verTodasSecretarias()
                && !supervisorRepository.contratosPorCorreo(ambito.correo()).contains(noContrato)) {
            return false;
        }
        if (!ambito.puede("CONTRATOS_VER")) return false;
        if (contratoApplicationService.puedeVer(noContrato, ambito)) return true;
        if (!"ENLACE".equals(ambito.rolCodigo())) return false;
        Long idSupervisor = supervisorRepository.idPorCorreo(ambito.correo());
        return (idSupervisor != null && indice.supervisadoPor(noContrato, idSupervisor))
                || indice.supervisadoPorEquipoSecretarias(noContrato, ambito.secretarias());
    }

    private AmbitoUsuario alcanceActual() {
        AmbitoUsuario ambito = sesionService.alcanceActual();
        if ("ENLACE".equals(ambito.rolCodigo())) {
            ambito = ambito.conSecretarias(supervisorRepository.secretariasPorCorreo(ambito.correo()));
        }
        return ambito;
    }

    private static boolean aceptaGzip(String acceptEncoding) {
        if (acceptEncoding == null) {
            return false;
        }
        for (String token : acceptEncoding.split(",")) {
            if (token.trim().split(";")[0].trim().equalsIgnoreCase("gzip")) {
                return true;
            }
        }
        return false;
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
