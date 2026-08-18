package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtTFondos;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CtTFondosRepository extends JpaRepository<CtTFondos, Long> {
    List<CtTFondos> findByNoContrato(String noContrato);
    List<CtTFondos> findByNoContratoIn(@Param("contratos") List<String> contratos);
}
