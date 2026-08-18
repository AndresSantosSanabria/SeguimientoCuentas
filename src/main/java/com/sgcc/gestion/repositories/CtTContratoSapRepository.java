package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtTContratoSap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CtTContratoSapRepository extends JpaRepository<CtTContratoSap, Long> {
    Optional<CtTContratoSap> findByNoContrato(String noContrato);
    List<CtTContratoSap> findAllByOrderByFechaInicioDesc();
}
