package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CtTContratoSapRepository extends JpaRepository<CtTContratoSap, Long> {
    Optional<CtTContratoSap> findByNoContrato(String noContrato);
    List<CtTContratoSap> findAllByOrderByFechaInicioDesc();
}
