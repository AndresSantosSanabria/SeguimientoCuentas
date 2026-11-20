package com.sgcc.seguimientocuentas.contratos.adapter.in;

import com.sgcc.seguimientocuentas.accesos.application.SesionService;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.common.dto.ComparativaSecretariaDTO;
import com.sgcc.seguimientocuentas.contratos.application.ComparativaSecretarias;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenIndex;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Comparativa entre secretarias para la analitica. Devuelve solo agregados por secretaria:
 * es el unico punto donde una secretaria se puede ver al lado de otra, y nunca muestra
 * el detalle de los contratos de la otra.
 */
@RestController
@RequestMapping("/api/analitica")
public class AnaliticaController {

    private static final String PERMISO_COMPARAR = "CONTRATOS_COMPARAR_SECRETARIAS";

    private final ContratoResumenIndex indice;
    private final SesionService sesionService;

    public AnaliticaController(ContratoResumenIndex indice, SesionService sesionService) {
        this.indice = indice;
        this.sesionService = sesionService;
    }

    @GetMapping(value = "/comparacion-secretarias", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<ComparativaSecretariaDTO>> comparacion(
            @RequestParam(required = false) String anios,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta,
            @RequestParam(required = false, defaultValue = "curso") String alcance) {
        AmbitoUsuario ambito = sesionService.alcanceActual();
        if (!ambito.puede("CONTRATOS_VER") || !ambito.puede(PERMISO_COMPARAR)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        ComparativaSecretarias comparativa = indice.comparativaSecretarias(
                anios(anios), fecha(desde), fecha(hasta), alcance);
        // Las secretarias sin contratos en este filtro tambien se ofrecen, con sus cifras en cero.
        // El orden es por carga de cobro pendiente, el mismo criterio de la grafica
        // «Cuentas por secretaria» de la pagina.
        List<ComparativaSecretariaDTO> respuesta = new ArrayList<>();
        for (String nombre : indice.secretariasCatalogo()) {
            ComparativaSecretariaDTO fila = comparativa.secretarias().stream()
                    .filter(secretaria -> secretaria.getSecretaria().equals(nombre))
                    .findFirst().orElse(null);
            respuesta.add(fila != null ? fila : vacia(nombre));
        }
        respuesta.sort(Comparator.comparingLong(ComparativaSecretariaDTO::getPendientes).reversed()
                .thenComparing(ComparativaSecretariaDTO::getSecretaria));
        return ResponseEntity.ok(respuesta);
    }

    private static ComparativaSecretariaDTO vacia(String secretaria) {
        ComparativaSecretariaDTO dto = new ComparativaSecretariaDTO();
        dto.setSecretaria(secretaria);
        dto.setCobertura(0);
        dto.setValorTotal(java.math.BigDecimal.ZERO);
        return dto;
    }

    private static List<Integer> anios(String valor) {
        List<Integer> lista = new ArrayList<>();
        if (valor == null || valor.isBlank()) {
            return lista;
        }
        for (String parte : valor.split(",")) {
            try {
                lista.add(Integer.parseInt(parte.trim()));
            } catch (NumberFormatException ignored) {
                // Un anio mal escrito se ignora: el resto del filtro sigue mandando.
            }
        }
        return lista;
    }

    private static LocalDate fecha(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(valor.trim().substring(0, Math.min(10, valor.trim().length())));
        } catch (RuntimeException e) {
            return null;
        }
    }
}
