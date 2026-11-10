package com.sgcc.seguimientocuentas.contratos.domain.model;

import java.util.Map;

/**
 * Los tres catalogos que traducen codigos a texto en el payload: estados del workflow, siguiente paso
 * sugerido y nombres de los supervisores. Se leen una vez al arrancar y se refrescan cuando el CDC
 * avisa de un cambio en ct_p_estado o en t_usuarios, para no volver a la base por un renombrado.
 */
public record Catalogos(Map<Integer, String> estados,
                        Map<Integer, String> siguientesPasos,
                        Map<Long, String> supervisores) {

    public String nombreEstado(int idEstado) {
        return estados.getOrDefault(idEstado, "Estado " + idEstado);
    }

    public String siguientePaso(int idEstado) {
        return siguientesPasos.get(idEstado);
    }

    public String nombreSupervisor(Long idSupervisor) {
        return supervisores.get(idSupervisor);
    }
}
