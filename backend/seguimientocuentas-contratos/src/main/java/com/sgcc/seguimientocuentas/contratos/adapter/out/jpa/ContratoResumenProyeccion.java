package com.sgcc.seguimientocuentas.contratos.adapter.out.jpa;

/**
 * Solo las columnas que el resumen necesita: evita materializar los 50.000 contratos completos.
 */
public interface ContratoResumenProyeccion {

    Long getId();

    String getNoContrato();

    String getContratista();

    String getDependencia();

    String getFechaInicio();

    String getFechaFin();
}
