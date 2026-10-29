package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CtPagoRepository extends JpaRepository<CtPago, Long> {
    List<CtPago> findByIdContratoSap(Long idContratoSap);
}
