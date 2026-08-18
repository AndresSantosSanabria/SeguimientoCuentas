package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtPTipoRegistro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CtPTipoRegistroRepository extends JpaRepository<CtPTipoRegistro, Long> {
}
