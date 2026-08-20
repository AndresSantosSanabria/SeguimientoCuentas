package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import com.sgcc.seguimientocuentas.contratos.domain.service.ContratoProgresoService;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTContratoSapRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

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

    public String obtenerProgreso(String noContrato) {
        return contratoProgresoService.calcularProgreso(noContrato);
    }
}
