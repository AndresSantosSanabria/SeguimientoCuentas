package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.contratos.domain.service.ContratoProgresoService;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTContratoSapRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ContratoApplicationService {

    private final CtTContratoSapRepository contratoSapRepository;
    private final ContratoProgresoService contratoProgresoService;

    public ContratoApplicationService(CtTContratoSapRepository contratoSapRepository,
                                       ContratoProgresoService contratoProgresoService) {
        this.contratoSapRepository = contratoSapRepository;
        this.contratoProgresoService = contratoProgresoService;
    }

    public List<ContratoResumenDTO> listarContratosResumen() {
        return contratoProgresoService.calcularResumenBatch(contratoSapRepository.findContratosResumen());
    }

    public String obtenerProgreso(String noContrato) {
        return contratoProgresoService.calcularProgreso(noContrato);
    }
}
