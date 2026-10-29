package com.sgcc.seguimientocuentas.cdc.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sgcc.seguimientocuentas.cdc.adapter.in.CDCWebSocketHandler;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtPEstadoRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTContratoSapRepository;
import com.sgcc.seguimientocuentas.contratos.application.ContratoResumenCache;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtPEstado;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CdcEventService - interpreta los eventos CDC y mantiene el estado en memoria de cada contrato.
 *
 * Los estados del workflow se leen de contratistas.ct_p_estado (19 estados en la base real
 * de supervisa). Si esa tabla no estuviera disponible, se usan los 19 estados por defecto.
 *
 * Los datos se guardan SOLO en memoria: al reiniciar la app el estado se reconstruye
 * con los eventos CDC que sigan llegando.
 */
@Service
public class CdcEventService {

    private static final Logger log = LoggerFactory.getLogger(CdcEventService.class);

    private static final int ESTADO_DEVOLUCION = 10;
    private static final int ESTADO_APROBADO = 19;
    private static final Set<Integer> ESTADOS_RECHAZO = Set.of(3, 8);

    private final ObjectMapper objectMapper;
    private final CDCWebSocketHandler webSocketHandler;
    private final CtPEstadoRepository estadoRepository;
    private final CtTContratoSapRepository contratoSapRepository;
    private final ContratoResumenCache resumenCache;

    private final Map<String, ObjectNode> estadoContratos = new ConcurrentHashMap<>();
    private final Map<String, Map<Long, Integer>> contratosCuentas = new ConcurrentHashMap<>();
    private final Map<Integer, String> estadosMap = new ConcurrentHashMap<>();
    private final Map<Integer, String> siguientesPasosMap = new HashMap<>();
    private final Map<Integer, Integer> avancePorEstado = new HashMap<>();

    public CdcEventService(ObjectMapper objectMapper,
                           CDCWebSocketHandler webSocketHandler,
                           CtPEstadoRepository estadoRepository,
                           CtTContratoSapRepository contratoSapRepository,
                           ContratoResumenCache resumenCache) {
        this.objectMapper = objectMapper;
        this.webSocketHandler = webSocketHandler;
        this.estadoRepository = estadoRepository;
        this.contratoSapRepository = contratoSapRepository;
        this.resumenCache = resumenCache;
    }

    @PostConstruct
    public void init() {
        cargarAvances();
        cargarSiguientesPasos();
        cargarEstados();
        log.info("CDC configurado con {} estados de contrato", estadosMap.size());
    }

    private void cargarAvances() {
        avancePorEstado.put(1, 6);
        avancePorEstado.put(2, 12);
        avancePorEstado.put(3, 12);
        avancePorEstado.put(4, 18);
        avancePorEstado.put(5, 25);
        avancePorEstado.put(6, 31);
        avancePorEstado.put(7, 37);
        avancePorEstado.put(8, 37);
        avancePorEstado.put(9, 43);
        avancePorEstado.put(10, 43);
        avancePorEstado.put(11, 56);
        avancePorEstado.put(12, 62);
        avancePorEstado.put(13, 75);
        avancePorEstado.put(14, 81);
        avancePorEstado.put(15, 87);
        avancePorEstado.put(16, 90);
        avancePorEstado.put(17, 93);
        avancePorEstado.put(18, 96);
        avancePorEstado.put(19, 100);
    }

    private void cargarSiguientesPasos() {
        siguientesPasosMap.put(1, "Enviar informe de actividades a revisión");
        siguientesPasosMap.put(2, "Supervisor revisa y aprueba o rechaza");
        siguientesPasosMap.put(3, "Contratista corrige y reenvía el informe");
        siguientesPasosMap.put(4, "Firmar informe de actividades");
        siguientesPasosMap.put(5, "Solicitar pantallas SECOP y firmar");
        siguientesPasosMap.put(6, "Cargar pantallas SECOP");
        siguientesPasosMap.put(7, "Supervisor aprueba o rechaza SECOP");
        siguientesPasosMap.put(8, "Corregir pantallas SECOP");
        siguientesPasosMap.put(9, "Registrar supervisión");
        siguientesPasosMap.put(10, "Contratista corrige y reenvía el informe");
        siguientesPasosMap.put(11, "Crear RAS");
        siguientesPasosMap.put(12, "Enviar informe al enlace");
        siguientesPasosMap.put(13, "Enviar informe al área jurídica");
        siguientesPasosMap.put(14, "Enviar informe al usuario MM");
        siguientesPasosMap.put(15, "Enviar informe al usuario FI");
        siguientesPasosMap.put(16, "Enviar informe al ordenador del gasto");
        siguientesPasosMap.put(17, "Enviar informe a tesorería");
        siguientesPasosMap.put(18, "Aprobación final por tesorería");
        siguientesPasosMap.put(19, "Proceso completado");
    }

    private void cargarEstados() {
        try {
            for (CtPEstado estado : estadoRepository.findAll()) {
                if (estado.getId() != null && estado.getDescripcion() != null) {
                    estadosMap.put(estado.getId(), estado.getDescripcion());
                }
            }
        } catch (Exception e) {
            log.warn("No se pudo leer ct_p_estado, se usan estados por defecto: {}", e.getMessage());
        }

        if (estadosMap.isEmpty()) {
            estadosMap.put(1, "Registrando");
            estadosMap.put(2, "En revisión");
            estadosMap.put(3, "Rechazado");
            estadosMap.put(4, "Aprobado pendiente firma");
            estadosMap.put(5, "Aprobado pendiente firma y SECOP");
            estadosMap.put(6, "Pendiente SECOP");
            estadosMap.put(7, "En revisión SECOP");
            estadosMap.put(8, "Rechazado SECOP");
            estadosMap.put(9, "Aprobado");
            estadosMap.put(10, "Informe devuelto al supervisor");
            estadosMap.put(11, "Supervisión registrada");
            estadosMap.put(12, "RAS registrado");
            estadosMap.put(13, "Informe enviado a enlace");
            estadosMap.put(14, "Informe enviado a abogado");
            estadosMap.put(15, "Informe enviado a usuario MM");
            estadosMap.put(16, "Informe enviado a usuario FI");
            estadosMap.put(17, "Informe enviado a ordenador del gasto");
            estadosMap.put(18, "Informe enviado a tesorería");
            estadosMap.put(19, "Informe aprobado");
        }
    }

    public void procesarEvento(String destination, String value) {
        try {
            if (destination != null && destination.contains("heartbeat")) {
                return;
            }

            if (value == null) {
                return;
            }

            JsonNode rootNode = objectMapper.readTree(value);
            JsonNode afterNode = rootNode.path("payload").path("after");

            // Un DELETE trae payload.after = null y por ahora no se refleja en el estado.
            if (afterNode.isMissingNode() || afterNode.isNull()) {
                return;
            }

            ObjectNode contenido = afterNode.deepCopy();
            String tabla = destination != null ? destination : "desconocida";
            String noContrato = extraerNoContrato(tabla, contenido);

            if (noContrato == null || noContrato.isEmpty()) {
                return;
            }

            boolean actualizado = actualizarEstado(tabla, contenido, noContrato);
            if (!actualizado) {
                return;
            }

            log.info("CAMBIO DETECTADO - Contrato: {} - Tabla: {}", noContrato, tabla);
            mostrarEstadoActual(noContrato);
            notificarWebSocket(noContrato, tabla);
            resumenCache.invalidar();

        } catch (Exception e) {
            log.error("Error procesando evento CDC", e);
        }
    }

    private String extraerNoContrato(String tabla, ObjectNode contenido) {
        if (tabla.contains("ct_t_trazabilidad")) {
            return contenido.path("no_contrato").asText(null);
        }
        if (tabla.contains("ct_t_supervision")) {
            return contenido.path("no_contrato").asText(null);
        }
        if (tabla.contains("ct_t_fondos")) {
            return contenido.path("no_contrato").asText(null);
        }
        if (tabla.contains("ct_t_informe_documento")) {
            return contenido.path("no_contrato").asText(null);
        }
        if (tabla.contains("ct_t_informe_actividades")) {
            return contenido.path("no_contrato").asText(null);
        }
        if (tabla.contains("ct_pago")) {
            // ct_pago no guarda no_contrato: se resuelve por su FK id_ct_t_contrato_sap
            long idContratoSap = contenido.path("id_ct_t_contrato_sap").asLong(0);
            if (idContratoSap <= 0) {
                return null;
            }
            return contratoSapRepository.findById(idContratoSap)
                    .map(CtTContratoSap::getNoContrato)
                    .orElse(null);
        }
        return null;
    }

    private boolean actualizarEstado(String tabla, ObjectNode contenido, String noContrato) {
        ObjectNode estado = estadoContratos.computeIfAbsent(noContrato, k -> objectMapper.createObjectNode());

        if (tabla.contains("ct_t_trazabilidad")) {
            int idEstado = contenido.path("id_estado").asInt(0);
            long idInformeActividad = contenido.path("id_informe_actividad").asLong(0);
            String fecha = convertirTimestamp(contenido.path("fecha"));
            String descripcion = contenido.path("descripcion").asText("");

            estado.put("id_estado", idEstado);
            estado.put("estado", nombreEstado(idEstado));
            estado.put("fecha_estado", fecha);
            estado.put("detalle_estado", descripcion);

            boolean esDevolucion = idEstado == ESTADO_DEVOLUCION;
            boolean esRechazo = ESTADOS_RECHAZO.contains(idEstado);
            estado.put("es_devolucion", esDevolucion);
            estado.put("es_rechazo", esRechazo);

            if (esDevolucion || esRechazo) {
                int pasoAnterior = estado.path("id_estado_anterior").asInt(0);
                estado.put("paso_anterior", pasoAnterior);
            } else {
                estado.put("id_estado_anterior", idEstado);
            }

            if (idInformeActividad > 0) {
                Map<Long, Integer> cuentas = contratosCuentas.computeIfAbsent(
                        noContrato, k -> new ConcurrentHashMap<>());
                cuentas.put(idInformeActividad, idEstado);

                int avanceIndividual = avanceEstado(idEstado);
                estado.put("avance_individual", avanceIndividual);
                estado.put("cuenta_cobro_actual", idInformeActividad);
                estado.put("id_informe_actividad", idInformeActividad);

                log.info("  Avance cuenta #{}: {}%", idInformeActividad, avanceIndividual);
            }
            return true;
        }

        if (tabla.contains("ct_t_supervision")) {
            estado.put("ultima_supervision", contenido.path("no_supervision").asInt(0));
            estado.put("porcentaje_avance", contenido.path("porcentaje_avance").asInt(0));
            estado.put("en_firme", contenido.path("en_firme").asBoolean(false));
            estado.put("valor_supervision", contenido.path("valor_pago").asDouble(0));
            estado.put("riesgo_incumplimiento", contenido.path("riesgo_incumplimiento").asText(""));
            estado.put("supervision_desde", convertirFechaDia(contenido.path("fecha_desde")));
            estado.put("supervision_hasta", convertirFechaDia(contenido.path("fecha_hasta")));
            if (contenido.hasNonNull("observacion")) {
                estado.put("observacion_supervision", contenido.path("observacion").asText(""));
            }
            return true;
        }

        if (tabla.contains("ct_t_fondos")) {
            estado.put("ras_creado", true);
            estado.put("no_rpc", contenido.path("no_rpc").asLong(0));
            estado.put("fondo", contenido.path("fondo").asText(""));
            estado.put("nombre_fondo", contenido.path("nombre_fondo").asText(""));
            estado.put("ultimo_fondo_valor_inicial", contenido.path("valor_inicial").asDouble(0));
            estado.put("ultimo_fondo_saldo", contenido.path("saldo").asDouble(0));
            estado.put("ultimo_fondo_valor_pagar", contenido.path("valor_pagar").asDouble(0));
            return true;
        }

        if (tabla.contains("ct_t_informe_actividades")) {
            long idInforme = contenido.path("id").asLong(0);
            if (idInforme > 0) {
                estado.put("id_informe_actividad", idInforme);
            }
            estado.put("no_informe", contenido.path("no_informe").asInt(0));
            estado.put("num_informe", contenido.path("num_informe").asText(""));
            estado.put("tipo_informe", contenido.path("tipo_informe").asText(""));
            estado.put("informe_firmado", contenido.path("firmado").asBoolean(false));
            estado.put("requiere_secop", contenido.path("requiere_secop").asBoolean(false));
            estado.put("aplica_deduccion", contenido.path("aplica_deduccion").asBoolean(false));
            estado.put("valor_informe", contenido.path("valor_pago").asDouble(0));
            estado.put("informe_desde", convertirFechaDia(contenido.path("fecha_inicio")));
            estado.put("informe_hasta", convertirFechaDia(contenido.path("fecha_fin")));
            return true;
        }

        if (tabla.contains("ct_t_informe_documento")) {
            estado.put("ultimo_documento", contenido.path("url_documento").asText(""));
            estado.put("documento_comprimido", contenido.path("comprimido").asBoolean(false));
            estado.put("fecha_ultimo_documento", convertirTimestamp(contenido.path("fecha_creacion")));
            return true;
        }

        if (tabla.contains("ct_pago")) {
            estado.put("tiene_pago", true);
            estado.put("ultimo_pago_no", contenido.path("no_pago").asInt(0));
            estado.put("ultima_factura", contenido.path("no_factura").asLong(0));
            estado.put("ultimo_pago_valor", contenido.path("valor").asDouble(0));
            estado.put("ultima_fecha_pago", convertirFechaDia(contenido.path("fecha_pago")));
            return true;
        }

        return false;
    }

    private void mostrarEstadoActual(String noContrato) {
        ObjectNode estado = estadoContratos.get(noContrato);
        if (estado == null) {
            log.info("  Estado: SIN DATOS");
            return;
        }

        log.info("--- ESTADO ACTUAL DEL CONTRATO ---");
        log.info("  Contrato: {}", noContrato);

        if (estado.has("estado")) {
            log.info("  Paso del proceso: {}", estado.path("estado").asText());
        }
        if (estado.has("detalle_estado") && !estado.path("detalle_estado").asText().isEmpty()) {
            log.info("  Detalle: {}", estado.path("detalle_estado").asText());
        }
        if (estado.has("fecha_estado")) {
            log.info("  Fecha: {}", estado.path("fecha_estado").asText());
        }
        if (estado.has("ultima_supervision")) {
            log.info("  Ultima supervision: No. {}", estado.path("ultima_supervision").asInt());
            log.info("  Avance supervision: {}%", estado.path("porcentaje_avance").asInt());
        }
        if (estado.path("ras_creado").asBoolean(false)) {
            log.info("  RAS: CREADO");
        }

        int idEstado = estado.path("id_estado").asInt(0);
        String siguiente = siguientesPasosMap.get(idEstado);
        if (siguiente != null) {
            log.info("  Siguiente paso: {}", siguiente);
        }

        Map<Long, Integer> cuentas = contratosCuentas.get(noContrato);
        if (cuentas != null && !cuentas.isEmpty()) {
            log.info("  --- CUENTAS DE COBRO ---");
            int sumaAvances = 0;
            long cuentasPagadas = 0;
            for (Map.Entry<Long, Integer> entry : cuentas.entrySet()) {
                int avance = avanceEstado(entry.getValue());
                log.info("  Cuenta #{}: {}% - {}", entry.getKey(), avance, nombreEstado(entry.getValue()));
                sumaAvances += avance;
                if (entry.getValue() == ESTADO_APROBADO) {
                    cuentasPagadas++;
                }
            }
            int avanceGeneral = sumaAvances / cuentas.size();
            log.info("  Avance general contrato: {}% ({} de {} cuentas aprobadas)",
                    avanceGeneral, cuentasPagadas, cuentas.size());
            log.info("  ------------------------");
        }

        log.info("-----------------------------------");
    }

    private void notificarWebSocket(String noContrato, String tabla) {
        try {
            ObjectNode estado = estadoContratos.get(noContrato);
            if (estado == null) {
                return;
            }

            ObjectNode notificacion = objectMapper.createObjectNode();
            notificacion.put("tipo", "CAMBIO_DETECTADO");
            notificacion.put("contrato", noContrato);
            notificacion.put("tabla", tabla);
            notificacion.put("timestamp", System.currentTimeMillis());

            ObjectNode estadoCopia = estado.deepCopy();
            notificacion.set("estado", estadoCopia);

            int idEstado = estado.path("id_estado").asInt(0);
            String siguiente = siguientesPasosMap.get(idEstado);
            if (siguiente != null) {
                estadoCopia.put("siguiente_paso", siguiente);
            }

            Map<Long, Integer> cuentas = contratosCuentas.get(noContrato);
            if (cuentas != null && !cuentas.isEmpty()) {
                ArrayNode arrayCuentas = objectMapper.createArrayNode();
                int sumaAvances = 0;
                int cuentasPagadas = 0;

                for (Map.Entry<Long, Integer> entry : cuentas.entrySet()) {
                    int avance = avanceEstado(entry.getValue());
                    ObjectNode cuentaJson = objectMapper.createObjectNode();
                    cuentaJson.put("id_informe_actividad", entry.getKey());
                    cuentaJson.put("id_estado", entry.getValue());
                    cuentaJson.put("estado", nombreEstado(entry.getValue()));
                    cuentaJson.put("avance_individual", avance);
                    arrayCuentas.add(cuentaJson);

                    sumaAvances += avance;
                    if (entry.getValue() == ESTADO_APROBADO) {
                        cuentasPagadas++;
                    }
                }

                estadoCopia.set("cuentas_cobro", arrayCuentas);
                estadoCopia.put("avance_general_contrato", sumaAvances / cuentas.size());
                estadoCopia.put("total_cuentas_cobro", cuentas.size());
                estadoCopia.put("cuentas_aprobadas", cuentasPagadas);
            }

            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(notificacion);
            webSocketHandler.broadcast(json);

        } catch (Exception e) {
            log.error("Error notificando via WebSocket", e);
        }
    }

    private String nombreEstado(int idEstado) {
        return estadosMap.getOrDefault(idEstado, "Estado " + idEstado);
    }

    private int avanceEstado(int idEstado) {
        return avancePorEstado.getOrDefault(idEstado, 0);
    }

    /**
     * Debezium entrega timestamp sin zona como microsegundos desde epoch.
     * Si el valor ya viene como texto ISO se devuelve tal cual.
     */
    private String convertirTimestamp(JsonNode valor) {
        if (valor == null || valor.isMissingNode() || valor.isNull()) {
            return "";
        }

        long epoch = valor.isNumber() ? valor.asLong() : parsearNumero(valor.asText(""));

        if (epoch == Long.MIN_VALUE) {
            return valor.asText("");
        }

        long milisegundos = epoch > 100_000_000_000_000L ? epoch / 1000 : epoch;
        DateTimeFormatter formatter = DateTimeFormatter
                .ofPattern("yyyy-MM-dd HH:mm:ss")
                .withZone(ZoneId.systemDefault());
        return formatter.format(Instant.ofEpochMilli(milisegundos));
    }

    /**
     * Debezium entrega las columnas date como dias desde epoch.
     */
    private String convertirFechaDia(JsonNode valor) {
        if (valor == null || valor.isMissingNode() || valor.isNull()) {
            return "";
        }

        if (valor.isNumber()) {
            long dias = valor.asLong();
            return Math.abs(dias) < 100_000
                    ? LocalDate.ofEpochDay(dias).toString()
                    : convertirTimestamp(valor);
        }

        String texto = valor.asText("");
        long dias = parsearNumero(texto);
        if (dias == Long.MIN_VALUE) {
            return texto;
        }
        return Math.abs(dias) < 100_000 ? LocalDate.ofEpochDay(dias).toString() : convertirTimestamp(valor);
    }

    private long parsearNumero(String texto) {
        try {
            return Long.parseLong(texto);
        } catch (NumberFormatException e) {
            return Long.MIN_VALUE;
        }
    }
}
