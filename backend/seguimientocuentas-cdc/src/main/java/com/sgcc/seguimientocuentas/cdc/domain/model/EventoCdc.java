package com.sgcc.seguimientocuentas.cdc.domain.model;

import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * EventoCdc - Modelo de dominio que representa un evento de cambio en la BD.
 *
 * Esta clase es un "contenedor de informacion" que encapsula los datos
 * basicos de cada cambio detectado por el CDC.
 *
 * ACTUALMENTE NO SE USA en el codigo (el CdcEventService trabaja directo
 * con JsonNode), pero existe como base para futuras implementaciones
 * que necesiten pasar eventos entre capas de forma tipada.
 *
 * Campos:
 * - tabla: de que tabla viene el cambio (ej: "supervisa.contratistas.ct_t_trazabilidad")
 * - noContrato: numero de contrato afectado (ej: "CT-2024-001")
 * - contenido: los datos nuevos de la fila modificada (JSON con todos los campos)
 * - timestamp: momento en que se detecto el cambio (milisegundos desde epoch)
 *
 * Ejemplo de uso futuro:
 *   EventoCdc evento = new EventoCdc("ct_t_trazabilidad", "CT-2024-001", datos);
 *   notifier.enviar(evento);  // Enviar a otro sistema
 *   repository.guardar(evento);  // Persistir en BD
 */
public class EventoCdc {

    /** Nombre de la tabla donde ocurrio el cambio (incluye esquema) */
    private String tabla;

    /** Numero de contrato afectado por el cambio */
    private String noContrato;

    /** Contenido JSON de la fila despues del cambio (solo campos relevantes) */
    private ObjectNode contenido;

    /** Momento en que se detecto el cambio (System.currentTimeMillis()) */
    private long timestamp;

    /**
     * Crea un nuevo evento CDC.
     *
     * @param tabla      nombre de la tabla (ej: "supervisa.contratistas.ct_t_trazabilidad")
     * @param noContrato numero de contrato afectado
     * @param contenido  datos de la fila como JSON
     */
    public EventoCdc(String tabla, String noContrato, ObjectNode contenido) {
        this.tabla = tabla;
        this.noContrato = noContrato;
        this.contenido = contenido;
        this.timestamp = System.currentTimeMillis();
    }

    public String getTabla() { return tabla; }
    public void setTabla(String tabla) { this.tabla = tabla; }
    public String getNoContrato() { return noContrato; }
    public void setNoContrato(String noContrato) { this.noContrato = noContrato; }
    public ObjectNode getContenido() { return contenido; }
    public void setContenido(ObjectNode contenido) { this.contenido = contenido; }
    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
