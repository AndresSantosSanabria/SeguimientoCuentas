package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTRazabilidad;
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

    @Query(value = "SELECT t.* FROM contratistas.ct_t_trazabilidad t " +
           "WHERE t.no_contrato IN :contratos AND t.id_informe_actividad IS NOT NULL " +
           "ORDER BY t.no_contrato, t.id_informe_actividad, t.id", nativeQuery = true)
    List<CtTRazabilidad> findPorInformeDeContratos(@Param("contratos") List<String> contratos);
}
