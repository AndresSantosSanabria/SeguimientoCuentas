package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import org.springframework.data.repository.query.Param;

@Repository
public interface CtTContratoSapRepository extends JpaRepository<CtTContratoSap, Long> {

    Optional<CtTContratoSap> findByNoContrato(String noContrato);

    /**
     * Todos los contratos con contratista, del más reciente al más antiguo. El orden cierra por `id`
     * para que dos contratos con la misma fecha de inicio no alternen posición entre reconstrucciones
     * del caché, que publicaría un ETag distinto sin que cambió nada.
     */
    @Query(value = "SELECT c.id, c.no_contrato, c.contratista, c.dependencia, c.fecha_inicio, c.fecha_fin, c.valor_total " +
            "FROM contratacion.ct_t_contrato_sap c " +
            "WHERE c.no_contrato IS NOT NULL AND btrim(coalesce(c.contratista, '')) <> '' " +
            "ORDER BY c.fecha_inicio DESC NULLS LAST, c.id DESC", nativeQuery = true)
    List<ContratoResumenProyeccion> findContratosResumen();

    /** Las dependencias tal como estan escritas: el nombre visible de cada secretaria. */
    @Query(value = "SELECT DISTINCT btrim(c.dependencia) " +
            "FROM contratacion.ct_t_contrato_sap c " +
            "WHERE c.dependencia IS NOT NULL AND btrim(c.dependencia) <> ''", nativeQuery = true)
    List<String> findDependenciasDistintas();
}
