package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CtTContratoSapRepository extends JpaRepository<CtTContratoSap, Long> {

    Optional<CtTContratoSap> findByNoContrato(String noContrato);

    @Query(value = "SELECT x.id, x.no_contrato, x.contratista, x.dependencia, x.fecha_inicio, x.fecha_fin " +
            "FROM (SELECT DISTINCT ON (upper(btrim(c.contratista))) " +
            "              c.id, c.no_contrato, c.contratista, c.dependencia, c.fecha_inicio, c.fecha_fin " +
            "      FROM contratacion.ct_t_contrato_sap c " +
            "      WHERE c.no_contrato IS NOT NULL AND btrim(coalesce(c.contratista, '')) <> '' " +
            "      ORDER BY upper(btrim(c.contratista)), c.fecha_inicio DESC NULLS LAST, c.id DESC) x " +
            "ORDER BY x.fecha_inicio DESC NULLS LAST", nativeQuery = true)
    List<ContratoResumenProyeccion> findContratosResumen();
}
