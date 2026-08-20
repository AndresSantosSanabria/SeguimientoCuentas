package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTSupervision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CtTSupervisionRepository extends JpaRepository<CtTSupervision, Long> {
    List<CtTSupervision> findByNoContratoOrderByNoSupervisionAsc(String noContrato);
    int countByNoContrato(String noContrato);

    @Query("SELECT s FROM CtTSupervision s WHERE s.noContrato IN :contratos")
    List<CtTSupervision> findByNoContratoIn(@Param("contratos") List<String> contratos);
}
