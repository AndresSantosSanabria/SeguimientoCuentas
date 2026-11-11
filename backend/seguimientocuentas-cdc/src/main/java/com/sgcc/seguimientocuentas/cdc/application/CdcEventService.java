package com.sgcc.seguimientocuentas.cdc.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sgcc.seguimientocuentas.cdc.adapter.in.CDCWebSocketHandler;
import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaDetalleDTO;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.InformeActividadRow;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenIndex;
import com.sgcc.seguimientocuentas.contratos.domain.model.FichaContrato;
import com.sgcc.seguimientocuentas.contratos.domain.service.ContratoProgresoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;

/**
 * Traduce un evento de Debezium en un parche del indice en memoria.
 *
 * El evento se interpreta por su operacion: `c`/`u`/`r` traen la fila nueva en payload.after y `d`
 * trae la eliminada en payload.before, asi que una baja también llega al indice en vez de perderse.
 * Aqui no se guarda estado propio: la ficha del contrato es la unica fuente de verdad, y el aviso
 * por WebSocket se arma a partir de ella. Por eso no queda nada que reconciliar contra la base.
 */
@Service
public class CdcEventService {

    private static final Logger log = LoggerFactory.getLogger(CdcEventService.class);

    private static final int ESTADO_DEVOLUCION = 10;
    private static final int ESTADO_APROBADO = 19;
    private static final Set<Integer> ESTADOS_RECHAZO = Set.of(3, 8);

    /** Curva de avance por estado, solo para el aviso en vivo: el payload oficial sale del indice. */
    private static final Map<Integer, Integer> AVANCE_POR_ESTADO = Map.ofEntries(
            Map.entry(1, 6), Map.entry(2, 12), Map.entry(3, 12), Map.entry(4, 18), Map.entry(5, 25),
            Map.entry(6, 31), Map.entry(7, 37), Map.entry(8, 37), Map.entry(9, 43), Map.entry(10, 43),
            Map.entry(11, 56), Map.entry(12, 62), Map.entry(13, 75), Map.entry(14, 81), Map.entry(15, 87),
            Map.entry(16, 90), Map.entry(17, 93), Map.entry(18, 96), Map.entry(19, 100));

    private enum Tabla {
        MAESTRO("ct_t_contrato_sap"),
        TRAZABILIDAD("ct_t_trazabilidad"),
        INFORME("ct_t_informe_actividades"),
        DOCUMENTO("ct_t_informe_documento"),
        SUPERVISION("ct_t_supervision"),
        FONDOS("ct_t_fondos"),
        PAGO("ct_pago"),
        ESTADOS("ct_p_estado"),
        USUARIOS("t_usuarios");

        private final String nombre;

        Tabla(String nombre) {
            this.nombre = nombre;
        }

        /** El destino de Debezium es prefijo.esquema.tabla: se reconoce por el nombre de la tabla. */
        private static Tabla desde(String destino) {
            for (Tabla tabla : values()) {
                if (destino.contains(tabla.nombre)) {
                    return tabla;
                }
            }
            return null;
        }
    }

    private final ObjectMapper objectMapper;
    private final CDCWebSocketHandler webSocketHandler;
    private final ContratoResumenIndex indice;
    private final ContratoProgresoService progresoService;

    public CdcEventService(ObjectMapper objectMapper,
                           CDCWebSocketHandler webSocketHandler,
                           ContratoResumenIndex indice,
                           ContratoProgresoService progresoService) {
        this.objectMapper = objectMapper;
        this.webSocketHandler = webSocketHandler;
        this.indice = indice;
        this.progresoService = progresoService;
    }

    public void procesarEvento(String destination, String value) {
        try {
            if (destination == null || value == null || destination.contains("heartbeat")) {
                return;
            }
            JsonNode payload = objectMapper.readTree(value).path("payload");
            String operacion = payload.path("op").asText("r");
            boolean esBaja = "d".equals(operacion);

            // En una baja la fila nueva no existe: payload.before es la que dice que se eliminó.
            JsonNode fila = esBaja ? payload.path("before") : payload.path("after");
            if (fila.isMissingNode() || fila.isNull()) {
                return;
            }

            Tabla tabla = Tabla.desde(destination);
            if (tabla == null) {
                return;
            }
            if (tabla == Tabla.ESTADOS || tabla == Tabla.USUARIOS) {
                if (tabla == Tabla.ESTADOS) {
                    progresoService.recargarEstados();
                } else {
                    progresoService.actualizarSupervisor(fila.path("id").asLong(0),
                            texto(fila.path("nombre")), esBaja);
                }
                indice.refrescarCatalogos();
                log.info("Catalogo de {} actualizado por CDC", tabla == Tabla.ESTADOS ? "estados" : "supervisores");
                return;
            }

            String noContrato = esBaja ? null : resolverContrato(tabla, fila);
            String afectado = aplicar(tabla, esBaja, "c".equals(operacion), noContrato, fila);
            if (afectado == null) {
                return;
            }

            FichaContrato ficha = indice.buscar(afectado);
            if (ficha == null) {
                // Contrato fuera del resumen (sin contratista) o borrado: el indice ya lo dio de baja.
                return;
            }
            log.info("CDC {} {} en {} - estado {} ({}) - {} cuentas radicadas, {} en mora",
                    operacion, afectado, tabla.nombre, ficha.dto().getIdEstadoActual(),
                    ficha.dto().getEstadoActual(), ficha.dto().getCuentasRegistradas(),
                    ficha.dto().getCuentasEnMora());
            notificar(afectado, tabla, ficha, fila);
        } catch (Exception e) {
            log.error("Error procesando evento CDC", e);
        }
    }

    /** ct_pago no guarda no_contrato: su FK se resuelve con el indice, que ya tiene el mapeo id -> contrato. */
    private String resolverContrato(Tabla tabla, JsonNode fila) {
        if (tabla == Tabla.PAGO) {
            long idContratoSap = fila.path("id_ct_t_contrato_sap").asLong(0);
            return idContratoSap > 0 ? indice.contratoPorIdSap(idContratoSap) : null;
        }
        return texto(fila.path("no_contrato"));
    }

    /**
     * Parchea el indice y dice que contrato resulto tocado.
     *
     * En una alta o actualizacion el nombre viene en la fila. En una baja no: la identidad de replica
     * por defecto de estas tablas hace que payload.before solo entregue la clave primaria, asi que el
     * indice es quien responde a que contrato pertenece esa clave.
     *
     * @return null cuando el evento no toca ningun contrato del resumen.
     */
    private String aplicar(Tabla tabla, boolean esBaja, boolean esAlta, String noContrato, JsonNode fila) {
        long id = fila.path("id").asLong(0);
        return switch (tabla) {
            case MAESTRO -> esBaja
                    ? indice.aplicarBajaMaestro(id)
                    : aplicarMaestro(id, noContrato, fila);
            case TRAZABILIDAD -> esBaja
                    ? indice.aplicarBajaTrazabilidad(id)
                    : aplicarTrazabilidad(id, noContrato, fila);
            case INFORME -> esBaja
                    ? indice.aplicarBajaInforme(id)
                    : aplicarInforme(id, noContrato, fila);
            case SUPERVISION -> {
                indice.aplicarEventoSupervision(noContrato, esAlta, esBaja,
                        fila.hasNonNull("porcentaje_avance") ? (short) fila.path("porcentaje_avance").asInt() : null,
                        numeroLargo(fila.path("id_supervisor")));
                yield noContrato;
            }
            // Documentos, RAS y pagos no alimentan el resumen; solo se anuncian en vivo.
            default -> esBaja ? null : noContrato;
        };
    }

    private String aplicarMaestro(long id, String noContrato, JsonNode fila) {
        indice.aplicarMaestro(id, noContrato,
                texto(fila.path("contratista")), texto(fila.path("dependencia")),
                textoFecha(fila.path("fecha_inicio")), textoFecha(fila.path("fecha_fin")),
                fila.path("valor_total").isNumber() ? fila.path("valor_total").decimalValue() : null);
        return noContrato;
    }

    private String aplicarTrazabilidad(long id, String noContrato, JsonNode fila) {
        indice.aplicarTrazabilidad(noContrato, id, fila.path("id_estado").asInt(0),
                numeroLargo(fila.path("id_informe_actividad")), fecha(fila.path("fecha")),
                texto(fila.path("descripcion")));
        return noContrato;
    }

    private String aplicarInforme(long id, String noContrato, JsonNode fila) {
        indice.aplicarInforme(new InformeActividadRow(
                id,
                noContrato,
                fila.hasNonNull("no_informe") ? fila.path("no_informe").asInt() : null,
                texto(fila.path("num_informe")),
                dia(fila.path("fecha_inicio")),
                dia(fila.path("fecha_fin")),
                texto(fila.path("tipo_informe")),
                fila.path("requiere_secop").asBoolean(false),
                fila.path("firmado").asBoolean(false)));
        return noContrato;
    }

    /**
     * El aviso en vivo sale de la ficha ya parcheada, con los mismos nombres que espera el frontend.
     * Nada de esto se guarda: es una foto del indice en el momento del evento.
     */
    private void notificar(String noContrato, Tabla tabla, FichaContrato ficha, JsonNode fila) {
        try {
            ContratoResumenDTO dto = ficha.dto();
            ObjectNode estado = objectMapper.createObjectNode();
            estado.put("id_estado", dto.getIdEstadoActual());
            estado.put("estado", dto.getEstadoActual());
            estado.put("detalle_estado", dto.getDescripcion());
            estado.put("fecha_estado", dto.getFechaEstado());
            estado.put("siguiente_paso", dto.getSiguientePaso());
            estado.put("porcentaje_avance", dto.getAvanceDeclarado());
            estado.put("ultima_supervision", dto.getTotalSupervisiones());
            estado.put("cuentas_registradas", dto.getCuentasRegistradas());
            estado.put("cuentas_en_mora", dto.getCuentasEnMora());
            if (tabla == Tabla.SUPERVISION) {
                estado.put("en_firme", fila.path("en_firme").asBoolean(false));
            }
            if (tabla == Tabla.TRAZABILIDAD) {
                estado.put("es_devolucion", dto.getIdEstadoActual() == ESTADO_DEVOLUCION);
                estado.put("es_rechazo", ESTADOS_RECHAZO.contains(dto.getIdEstadoActual()));
                Integer anterior = pasoAnterior(dto);
                if (anterior != null) {
                    estado.put("paso_anterior", anterior);
                }
            }

            ArrayNode cuentas = estado.putArray("cuentas_cobro");
            int sumaAvances = 0;
            int aprobadas = 0;
            for (CuentaDetalleDTO cuenta : dto.getCuentasDetalle()) {
                ObjectNode nodo = cuentas.addObject();
                nodo.put("id_informe_actividad", cuenta.getIdInformeActividad());
                nodo.put("id_estado", cuenta.getIdEstadoActual());
                nodo.put("estado", cuenta.getEstadoActual());
                nodo.put("avance_individual", avanceEstado(cuenta.getIdEstadoActual()));
                if (cuenta.isActiva()) {
                    estado.put("cuenta_cobro_actual", cuenta.getIdInformeActividad());
                }
                sumaAvances += avanceEstado(cuenta.getIdEstadoActual());
                if (cuenta.getIdEstadoActual() == ESTADO_APROBADO) {
                    aprobadas++;
                }
            }
            int total = dto.getCuentasDetalle().size();
            if (total > 0) {
                estado.put("avance_general_contrato", sumaAvances / total);
                estado.put("total_cuentas_cobro", total);
                estado.put("cuentas_aprobadas", aprobadas);
            }

            ObjectNode notificacion = objectMapper.createObjectNode();
            notificacion.put("tipo", "CAMBIO_DETECTADO");
            notificacion.put("contrato", noContrato);
            notificacion.put("tabla", tabla.nombre);
            notificacion.put("dependencia", dto.getDependencia());
            notificacion.put("timestamp", System.currentTimeMillis());
            notificacion.set("estado", estado);

            webSocketHandler.broadcast(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(notificacion),
                    dto.getDependencia(), dto.getContratista(), noContrato);
        } catch (Exception e) {
            log.error("Error notificando via WebSocket", e);
        }
    }

    /** El paso previo al actual de la cuenta en curso, para marcar devoluciones y rechazos. */
    private static Integer pasoAnterior(ContratoResumenDTO dto) {
        return dto.getCuentasDetalle().stream()
                .filter(CuentaDetalleDTO::isActiva)
                .findFirst()
                .map(cuenta -> cuenta.getPasos())
                .filter(pasos -> pasos.size() >= 2)
                .map(pasos -> pasos.get(pasos.size() - 2).getIdEstado())
                .orElse(null);
    }

    private static int avanceEstado(int idEstado) {
        return AVANCE_POR_ESTADO.getOrDefault(idEstado, 0);
    }

    private static String texto(JsonNode nodo) {
        return nodo == null || nodo.isNull() ? null : nodo.asText();
    }

    private static Long numeroLargo(JsonNode nodo) {
        if (nodo == null || nodo.isNull() || nodo.asLong(0) <= 0) {
            return null;
        }
        return nodo.asLong();
    }

    /** Las fechas de la tabla maestra son texto en la base; si vinieran como dia epoch se normaliza. */
    private static String textoFecha(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isNumber()) {
            LocalDate fecha = dia(nodo);
            return fecha != null ? fecha.toString() : nodo.asText();
        }
        String texto = nodo.asText();
        return texto.isBlank() ? null : texto;
    }

    /** Debezium entrega las columnas date como dias desde el epoch. */
    private static LocalDate dia(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isNumber()) {
            return LocalDate.ofEpochDay(nodo.asLong());
        }
        String texto = nodo.asText().trim();
        if (texto.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(texto.substring(0, Math.min(10, texto.length())));
        } catch (Exception e) {
            return null;
        }
    }

    /** Debezium entrega los timestamp sin zona como microsegundos desde el epoch. */
    private static LocalDateTime fecha(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isNumber()) {
            long microsegundos = nodo.asLong();
            Instant instant = Instant.ofEpochSecond(Math.floorDiv(microsegundos, 1_000_000L),
                    Math.floorMod(microsegundos, 1_000_000L) * 1_000L);
            return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
        }
        String texto = nodo.asText().trim();
        if (texto.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(texto.length() > 19 ? texto.substring(0, 19) : texto);
        } catch (Exception e) {
            return null;
        }
    }
}
