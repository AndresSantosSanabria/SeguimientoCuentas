package com.sgcc.gestion.controllers;

import com.sgcc.gestion.dto.ContratoResumenDTO;
import com.sgcc.gestion.entities.CtTContratoSap;
import com.sgcc.gestion.repositories.CtTContratoSapRepository;
import com.sgcc.gestion.services.ContratoProgresoService;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/contratos")
public class ContratoController {

    private final CtTContratoSapRepository contratoSapRepository;
    private final ContratoProgresoService contratoProgresoService;

    public ContratoController(CtTContratoSapRepository contratoSapRepository,
                              ContratoProgresoService contratoProgresoService) {
        this.contratoSapRepository = contratoSapRepository;
        this.contratoProgresoService = contratoProgresoService;
    }

    @GetMapping
    public List<ContratoResumenDTO> listarTodos() {
        List<CtTContratoSap> todos = contratoSapRepository.findAllByOrderByFechaInicioDesc();

        Map<String, CtTContratoSap> porContratista = new LinkedHashMap<>();
        for (CtTContratoSap c : todos) {
            String key = c.getContratista() != null ? c.getContratista().trim().toUpperCase() : "";
            if (!key.isEmpty() && !porContratista.containsKey(key)) {
                porContratista.put(key, c);
            }
        }

        List<CtTContratoSap> unicos = new ArrayList<>(porContratista.values());
        return contratoProgresoService.calcularResumenBatch(unicos);
    }

    @GetMapping("/{noContrato}")
    public String verProgreso(@PathVariable String noContrato) {
        return contratoProgresoService.calcularProgreso(noContrato);
    }
}
