package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtTRazabilidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CtTRazabilidadRepository extends JpaRepository<CtTRazabilidad, Long> {
    long countByNoContrato(String noContrato);
    boolean existsByNoContratoAndIdEstado(String noContrato, int idEstado);
    List<CtTRazabilidad> findByNoContratoOrderByFechaDesc(String noContrato);

    @Query(value = "SELECT t.* FROM contratistas.ct_t_trazabilidad t " +
           "INNER JOIN (SELECT no_contrato, MAX(id) as max_id FROM contratistas.ct_t_trazabilidad WHERE no_contrato IN :contratos GROUP BY no_contrato) sub " +
           "ON t.id = sub.max_id", nativeQuery = true)
    List<CtTRazabilidad> findUltimaPorContratos(@Param("contratos") List<String> contratos);
}
