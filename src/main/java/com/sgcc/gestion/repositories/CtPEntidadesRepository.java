package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtPEntidades;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CtPEntidadesRepository extends JpaRepository<CtPEntidades, Long> {
}
