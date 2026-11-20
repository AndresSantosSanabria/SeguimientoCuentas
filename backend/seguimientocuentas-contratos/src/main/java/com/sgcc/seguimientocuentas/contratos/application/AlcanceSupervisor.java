package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisorJdbcRepository;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * Los contratos que le corresponden a quien supervise.
 *
 * La asignacion vive en SupervisA: cada fila de ct_t_supervision dice que usuario responde por
 * ese contrato. Ese es el unico alcance del rol SUPERVISOR, asi que no se amplia con secretarias
 * ni con el nombre del contratista.
 */
@Service
public class AlcanceSupervisor {

    private final SupervisorJdbcRepository supervisorRepository;

    public AlcanceSupervisor(SupervisorJdbcRepository supervisorRepository) {
        this.supervisorRepository = supervisorRepository;
    }

    /** Contratos con supervision asignada al usuario de ese correo. */
    public Set<String> contratos(String correo, String nombre) {
        Long idSupervisor = supervisorRepository.idPorCorreoYNombre(correo, nombre);
        if (idSupervisor == null) {
            return Set.of();
        }
        return supervisorRepository.contratosSupervisadosPor(idSupervisor);
    }

    /** Si ese contrato esta dentro de la supervision de la persona. */
    public boolean supervisa(String correo, String nombre, String noContrato) {
        return contratos(correo, nombre).contains(noContrato);
    }
}
