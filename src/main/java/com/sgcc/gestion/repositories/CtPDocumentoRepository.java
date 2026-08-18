package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtPDocumento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CtPDocumentoRepository extends JpaRepository<CtPDocumento, Long> {
}
