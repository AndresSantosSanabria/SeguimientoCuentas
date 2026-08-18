package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CtPagoRepository extends JpaRepository<CtPago, Long> {
    List<CtPago> findByIdContratoSap(Long idContratoSap);
    List<CtPago> findByIdContratoSapIn(@Param("ids") List<Long> ids);
}
