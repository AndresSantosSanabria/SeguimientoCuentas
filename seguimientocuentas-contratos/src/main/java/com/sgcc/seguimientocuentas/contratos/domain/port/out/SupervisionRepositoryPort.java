package com.sgcc.seguimientocuentas.contratos.domain.port.out;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTSupervision;
import java.util.List;

public interface SupervisionRepositoryPort {
    List<CtTSupervision> findByNoContratoOrderByNoSupervisionAsc(String noContrato);
    int countByNoContrato(String noContrato);
    List<CtTSupervision> findByNoContratoIn(List<String> contratos);
}
