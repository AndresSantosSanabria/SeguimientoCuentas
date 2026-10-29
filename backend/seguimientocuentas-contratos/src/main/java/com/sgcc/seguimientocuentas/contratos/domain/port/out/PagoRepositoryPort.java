package com.sgcc.seguimientocuentas.contratos.domain.port.out;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtPago;
import java.util.List;

public interface PagoRepositoryPort {
    List<CtPago> findByIdContratoSap(Long idContratoSap);
    List<CtPago> findByIdContratoSapIn(List<Long> ids);
}
