package com.sgcc.seguimientocuentas.contratos.domain.port.out;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import java.util.List;
import java.util.Optional;

public interface ContratoRepositoryPort {
    Optional<CtTContratoSap> findByNoContrato(String noContrato);
    List<CtTContratoSap> findAllByOrderByFechaInicioDesc();
    List<CtTContratoSap> findAll();
}
