package com.sgcc.gestion.repositories;

import com.sgcc.gestion.entities.CtPEstado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CtPEstadoRepository extends JpaRepository<CtPEstado, Integer> {
}
