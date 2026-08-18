package com.sgcc.gestion.services;

import com.sgcc.gestion.dto.ContratoResumenDTO;
import com.sgcc.gestion.entities.*;
import com.sgcc.gestion.repositories.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ContratoProgresoService {

    private static final Logger log = LoggerFactory.getLogger(ContratoProgresoService.class);

    private final CtTContratoSapRepository contratoSapRepository;
    private final CtTSupervisionRepository supervisionRepository;
    private final CtTRazabilidadRepository trazabilidadRepository;
    private final CtTFondosRepository fondosRepository;
    private final CtPagoRepository pagoRepository;
    private final CtPEstadoRepository estadoRepository;

    private Map<Integer, String> estadosMap = new HashMap<>();
    private Map<Integer, String> siguientesPasosMap = new HashMap<>();

    public ContratoProgresoService(CtTContratoSapRepository contratoSapRepository,
                                    CtTSupervisionRepository supervisionRepository,
                                    CtTRazabilidadRepository trazabilidadRepository,
                                    CtTFondosRepository fondosRepository,
                                    CtPagoRepository pagoRepository,
                                    CtPEstadoRepository estadoRepository) {
        this.contratoSapRepository = contratoSapRepository;
        this.supervisionRepository = supervisionRepository;
        this.trazabilidadRepository = trazabilidadRepository;
        this.fondosRepository = fondosRepository;
        this.pagoRepository = pagoRepository;
        this.estadoRepository = estadoRepository;
    }

    @PostConstruct
    public void init() {
        List<CtPEstado> estados = estadoRepository.findAll();
        for (CtPEstado e : estados) {
            estadosMap.put(e.getId(), e.getDescripcion());
        }

        siguientesPasosMap.put(1, "Supervisor debe revisar informe");
        siguientesPasosMap.put(2, "Generar aprobación pendiente firma");
        siguientesPasosMap.put(3, "Contratista debe corregir informe");
        siguientesPasosMap.put(4, "Pendiente firma y SECOP");
        siguientesPasosMap.put(5, "Pendiente SECOP");
        siguientesPasosMap.put(6, "Revisión SECOP");
        siguientesPasosMap.put(7, "Aprobar o rechazar SECOP");
        siguientesPasosMap.put(8, "Volver a revisión SECOP");
        siguientesPasosMap.put(9, "Supervisor registra supervisión y crea RAS");
        siguientesPasosMap.put(10, "Volver a revisión del informe");
        siguientesPasosMap.put(11, "Crear RAS y enviar a enlace");
        siguientesPasosMap.put(12, "Enviar informe a enlace");
        siguientesPasosMap.put(13, "Enviar informe a abogado");
        siguientesPasosMap.put(14, "Enviar informe a ordenador del gasto");
        siguientesPasosMap.put(15, "Ordenador del gasto aprueba");
        siguientesPasosMap.put(16, "Proceso completado");

        log.info("Estados cargados desde ct_p_estado: {}", estadosMap.size());
    }

    public String calcularProgreso(String noContrato) {
        StringBuilder sb = new StringBuilder();
        sb.append("\n");
        sb.append("========================================\n");
        sb.append("CONTRATO: ").append(noContrato).append("\n");
        sb.append("========================================\n");

        Optional<CtTContratoSap> contratoOpt = contratoSapRepository.findByNoContrato(noContrato);
        if (contratoOpt.isEmpty()) {
            sb.append("  Contrato no encontrado\n");
            return sb.toString();
        }

        CtTContratoSap contrato = contratoOpt.get();
        sb.append("  Contratista: ").append(contrato.getContratista()).append("\n");
        sb.append("  Valor: $").append(String.format("%,.2f", contrato.getValorTotal())).append("\n");

        // Supervisiones
        List<CtTSupervision> supervisiones = supervisionRepository.findByNoContratoOrderByNoSupervisionAsc(noContrato);
        CtTSupervision ultimaSupervision = supervisiones.isEmpty() ? null : supervisiones.get(supervisiones.size() - 1);

        sb.append("\n--- SUPERVISION ---\n");
        sb.append("  Supervisiones: ").append(supervisiones.size()).append(" de 12\n");

        // Trazabilidad - último estado
        List<CtTRazabilidad> trazabilidades = trazabilidadRepository.findByNoContratoOrderByFechaDesc(noContrato);

        sb.append("\n--- FLUJO PROCESO ---\n");

        if (trazabilidades.isEmpty()) {
            sb.append("  Estado: SIN INICIO - Contratista debe cargar informe de actividades\n");
        } else {
            CtTRazabilidad ultimoRegistro = trazabilidades.get(0);
            String estadoActual = resolverEstado(ultimoRegistro.getIdEstado());
            String responsable = ultimoRegistro.getDescripcion() != null ? ultimoRegistro.getDescripcion() : "";

            sb.append("  Estado actual: ").append(estadoActual).append("\n");
            if (!responsable.isEmpty()) {
                sb.append("  Detalle: ").append(responsable).append("\n");
            }
            sb.append("  Fecha: ").append(ultimoRegistro.getFecha()).append("\n");

            // Paso siguiente según el diagrama
            String pasoSiguiente = determinarPasoSiguiente(ultimoRegistro.getIdEstado(), fondosRepository.findByNoContrato(noContrato), pagoRepository.findByIdContratoSap(contrato.getId()));
            if (pasoSiguiente != null) {
                sb.append("  Siguiente paso: ").append(pasoSiguiente).append("\n");
            }
        }

        // Supervisión actual
        if (ultimaSupervision != null) {
            sb.append("\n--- ESTADO SUPERVISIÓN ---\n");
            sb.append("  No. Supervisión: ").append(ultimaSupervision.getNoSupervision()).append("\n");
            sb.append("  % Avance: ").append(ultimaSupervision.getPorcentajeAvance() != null ? ultimaSupervision.getPorcentajeAvance() : 0).append("%\n");
            if (ultimaSupervision.getIdInformeActividad() != null) {
                sb.append("  Informe de actividades: CARGADO\n");
            } else {
                sb.append("  Informe de actividades: PENDIENTE\n");
            }
            if (ultimaSupervision.getEnFirme() != null && ultimaSupervision.getEnFirme()) {
                sb.append("  Estado: EN FIRME\n");
            }
            if (ultimaSupervision.getObservacion() != null && !ultimaSupervision.getObservacion().isEmpty()) {
                sb.append("  Observación: ").append(ultimaSupervision.getObservacion()).append("\n");
            }
        }

        // RAS / Fondos
        List<CtTFondos> fondos = fondosRepository.findByNoContrato(noContrato);
        sb.append("\n--- RAS ---\n");
        if (fondos.isEmpty()) {
            sb.append("  RAS: NO CREADO\n");
        } else {
            double totalInicial = fondos.stream().mapToDouble(f -> f.getValorInicial() != null ? f.getValorInicial() : 0).sum();
            double totalSaldo = fondos.stream().mapToDouble(f -> f.getSaldo() != null ? f.getSaldo() : 0).sum();
            sb.append("  RAS: CREADO\n");
            sb.append("  Fondos: ").append(fondos.size()).append("\n");
            sb.append("  Valor inicial: $").append(String.format("%,.2f", totalInicial)).append("\n");
            sb.append("  Saldo: $").append(String.format("%,.2f", totalSaldo)).append("\n");
        }

        // Pagos
        List<CtPago> pagos = pagoRepository.findByIdContratoSap(contrato.getId());
        sb.append("\n--- PAGO ---\n");
        if (pagos.isEmpty()) {
            sb.append("  Pagos: NO REGISTRADOS\n");
        } else {
            double totalPagado = pagos.stream().mapToDouble(p -> p.getValor() != null ? p.getValor() : 0).sum();
            sb.append("  Pagos: ").append(pagos.size()).append("\n");
            sb.append("  Total pagado: $").append(String.format("%,.2f", totalPagado)).append("\n");
        }

        sb.append("\n========================================\n");

        return sb.toString();
    }

    public List<ContratoResumenDTO> calcularResumenBatch(List<CtTContratoSap> contratos) {
        List<String> noContratos = contratos.stream()
                .map(CtTContratoSap::getNoContrato)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<CtTRazabilidad> todasRazabilidades = trazabilidadRepository.findUltimaPorContratos(noContratos);
        Map<String, CtTRazabilidad> trazabilidadMap = todasRazabilidades.stream()
                .collect(Collectors.toMap(CtTRazabilidad::getNoContrato, r -> r, (a, b) -> a));

        List<CtTSupervision> todasSupervisiones = supervisionRepository.findByNoContratoIn(noContratos);
        Map<String, List<CtTSupervision>> supervisionMap = todasSupervisiones.stream()
                .collect(Collectors.groupingBy(CtTSupervision::getNoContrato));

        List<CtTFondos> todosFondos = fondosRepository.findByNoContratoIn(noContratos);
        Map<String, List<CtTFondos>> fondosMap = todosFondos.stream()
                .collect(Collectors.groupingBy(CtTFondos::getNoContrato));

        List<Long> idsContratos = contratos.stream()
                .map(CtTContratoSap::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        List<CtPago> todosPagos = pagoRepository.findByIdContratoSapIn(idsContratos);
        Map<Long, List<CtPago>> pagosMap = todosPagos.stream()
                .collect(Collectors.groupingBy(CtPago::getIdContratoSap));

        List<ContratoResumenDTO> resultados = new ArrayList<>();

        for (CtTContratoSap contrato : contratos) {
            ContratoResumenDTO dto = new ContratoResumenDTO();
            dto.setId(contrato.getId());
            dto.setNoContrato(contrato.getNoContrato());
            dto.setContratista(contrato.getContratista());
            dto.setValorTotal(contrato.getValorTotal());
            dto.setRecepcionFacturas(contrato.getRecepcionFacturas());
            dto.setSaldo(contrato.getSaldo());
            dto.setFechaInicio(contrato.getFechaInicio());
            dto.setFechaFin(contrato.getFechaFin());

            List<CtTSupervision> sups = supervisionMap.getOrDefault(contrato.getNoContrato(), List.of());
            dto.setTotalSupervisiones(sups.size());
            dto.setTotalSupervisionesEsperadas(12);
            if (!sups.isEmpty()) {
                CtTSupervision ultima = sups.get(sups.size() - 1);
                dto.setPorcentajeAvance(ultima.getPorcentajeAvance() != null ? ultima.getPorcentajeAvance() : 0);
                dto.setInformeCargado(ultima.getIdInformeActividad() != null);
            }

            CtTRazabilidad traz = trazabilidadMap.get(contrato.getNoContrato());
            if (traz != null) {
                dto.setIdEstadoActual(traz.getIdEstado());
                dto.setEstadoActual(resolverEstado(traz.getIdEstado()));
                dto.setDescripcion(traz.getDescripcion());
                dto.setFechaEstado(traz.getFecha() != null ? traz.getFecha().toString() : null);

                List<CtTFondos> fondos = fondosMap.getOrDefault(contrato.getNoContrato(), List.of());
                List<CtPago> pagos = pagosMap.getOrDefault(contrato.getId(), List.of());
                dto.setSiguientePaso(determinarPasoSiguiente(traz.getIdEstado(), fondos, pagos));
            } else {
                dto.setIdEstadoActual(0);
                dto.setEstadoActual("SIN INICIO - Contratista debe cargar informe de actividades");
            }

            List<CtTFondos> fondos = fondosMap.getOrDefault(contrato.getNoContrato(), List.of());
            dto.setRasCreado(!fondos.isEmpty());
            dto.setTotalFondos(fondos.size());
            dto.setValorInicialRas(fondos.stream().mapToDouble(f -> f.getValorInicial() != null ? f.getValorInicial() : 0).sum());
            dto.setSaldoRas(fondos.stream().mapToDouble(f -> f.getSaldo() != null ? f.getSaldo() : 0).sum());

            List<CtPago> pagos = pagosMap.getOrDefault(contrato.getId(), List.of());
            dto.setTotalPagos(pagos.size());
            dto.setTotalPagado(pagos.stream().mapToDouble(p -> p.getValor() != null ? p.getValor() : 0).sum());

            resultados.add(dto);
        }

        return resultados;
    }

    private String resolverEstado(int idEstado) {
        return estadosMap.getOrDefault(idEstado, "Estado " + idEstado);
    }

    private String determinarPasoSiguiente(int idEstadoActual, List<CtTFondos> fondos, List<CtPago> pagos) {
        return siguientesPasosMap.get(idEstadoActual);
    }
}
