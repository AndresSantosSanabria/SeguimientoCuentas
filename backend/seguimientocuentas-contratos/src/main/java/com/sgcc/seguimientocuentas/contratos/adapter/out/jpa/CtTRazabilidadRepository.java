package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTRazabilidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CtTRazabilidadRepository extends JpaRepository<CtTRazabilidad, Long> {
    long countByNoContrato(String noContrato);
    boolean existsByNoContratoAndIdEstado(String noContrato, int idEstado);
    List<CtTRazabilidad> findByNoContratoOrderByFechaDesc(String noContrato);

    /** Todas las trazas de un contrato, en el orden del recorrido (id ascendente). */
    List<CtTRazabilidad> findByNoContratoOrderByIdAsc(String noContrato);

    /** Última traza de cada contrato; la tabla es chica, así que se lee completa en vez de filtrar por lista. */
    @Query(value = "SELECT t.* FROM contratistas.ct_t_trazabilidad t " +
           "INNER JOIN (SELECT no_contrato, MAX(id) as max_id FROM contratistas.ct_t_trazabilidad GROUP BY no_contrato) sub " +
           "ON t.id = sub.max_id", nativeQuery = true)
    List<CtTRazabilidad> findUltimaDeTodos();

    @Query(value = "SELECT t.* FROM contratistas.ct_t_trazabilidad t " +
           "WHERE t.id_informe_actividad IS NOT NULL " +
           "ORDER BY t.no_contrato, t.id_informe_actividad, t.id", nativeQuery = true)
    List<CtTRazabilidad> findPorInformeDeTodos();
}
