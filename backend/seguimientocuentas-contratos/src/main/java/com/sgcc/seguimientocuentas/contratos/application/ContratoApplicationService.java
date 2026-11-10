package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.contratos.domain.service.ContratoProgresoService;
import org.springframework.stereotype.Service;

@Service
public class ContratoApplicationService {

    private final ContratoProgresoService contratoProgresoService;

    public ContratoApplicationService(ContratoProgresoService contratoProgresoService) {
        this.contratoProgresoService = contratoProgresoService;
    }

    public String obtenerProgreso(String noContrato) {
        return contratoProgresoService.calcularProgreso(noContrato);
    }
}
