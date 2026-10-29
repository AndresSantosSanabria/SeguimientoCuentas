package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

import java.time.LocalDate;

public record InformeActividadRow(
        long id,
        String noContrato,
        Integer noInforme,
        String numInforme,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        String tipoInforme,
        boolean requiereSecop,
        boolean firmado
) {}
