package com.sgcc.seguimientocuentas.contratos.adapter.in;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.contratos.application.ContratoApplicationService;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/contratos")
public class ContratoController {

    private final ContratoApplicationService contratoApplicationService;

    public ContratoController(ContratoApplicationService contratoApplicationService) {
        this.contratoApplicationService = contratoApplicationService;
    }

    @GetMapping
    public List<ContratoResumenDTO> listarTodos() {
        return contratoApplicationService.listarContratosResumen();
    }

    @GetMapping("/{noContrato}")
    public String verProgreso(@PathVariable String noContrato) {
        return contratoApplicationService.obtenerProgreso(noContrato);
    }
}
