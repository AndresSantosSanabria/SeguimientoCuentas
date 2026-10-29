package com.sgcc.seguimientocuentas.contratos.domain.service;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaDetalleDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaPasoDTO;
import com.sgcc.seguimientocuentas.contratos.domain.model.*;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.*;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisionJdbcRepository.UltimaSupervision;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.time.Period;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ContratoProgresoService {

    private static final Logger log = LoggerFactory.getLogger(ContratoProgresoService.class);

    private final CtTContratoSapRepository contratoSapRepository;
    private final CtTSupervisionRepository supervisionRepository;
    private final SupervisionJdbcRepository supervisionJdbcRepository;
    private final CtTRazabilidadRepository trazabilidadRepository;
    private final CtTFondosRepository fondosRepository;
    private final CtPagoRepository pagoRepository;
    private final CtPEstadoRepository estadoRepository;
    private final InformeActividadJdbcRepository informeActividadRepository;
    private final SupervisorJdbcRepository supervisorRepository;

    private Map<Integer, String> estadosMap = new HashMap<>();
    private Map<Integer, String> siguientesPasosMap = new HashMap<>();

    public ContratoProgresoService(CtTContratoSapRepository contratoSapRepository,
                                    CtTSupervisionRepository supervisionRepository,
                                    SupervisionJdbcRepository supervisionJdbcRepository,
                                    CtTRazabilidadRepository trazabilidadRepository,
                                    CtTFondosRepository fondosRepository,
                                    CtPagoRepository pagoRepository,
                                    CtPEstadoRepository estadoRepository,
                                    InformeActividadJdbcRepository informeActividadRepository,
                                    SupervisorJdbcRepository supervisorRepository) {
        this.contratoSapRepository = contratoSapRepository;
        this.supervisionRepository = supervisionRepository;
        this.supervisionJdbcRepository = supervisionJdbcRepository;
        this.trazabilidadRepository = trazabilidadRepository;
        this.fondosRepository = fondosRepository;
        this.pagoRepository = pagoRepository;
        this.estadoRepository = estadoRepository;
        this.informeActividadRepository = informeActividadRepository;
        this.supervisorRepository = supervisorRepository;
    }

    @PostConstruct
    public void init() {
        List<CtPEstado> estados = estadoRepository.findAll();
        for (CtPEstado e : estados) {
            estadosMap.put(e.getId(), e.getDescripcion());
        }

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

        List<CtTSupervision> supervisiones = supervisionRepository.findByNoContratoOrderByNoSupervisionAsc(noContrato);
        CtTSupervision ultimaSupervision = supervisiones.isEmpty() ? null : supervisiones.get(supervisiones.size() - 1);

        sb.append("\n--- SUPERVISION ---\n");
        sb.append("  Supervisiones: ").append(supervisiones.size()).append(" de 12\n");

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

            String pasoSiguiente = siguientesPasosMap.get(ultimoRegistro.getIdEstado());
            if (pasoSiguiente != null) {
                sb.append("  Siguiente paso: ").append(pasoSiguiente).append("\n");
            }
        }

        if (ultimaSupervision != null) {
            int informesRegistrados = informeActividadRepository
                    .contarPorContratos(List.of(noContrato))
                    .getOrDefault(noContrato, 0);
            sb.append("\n--- ESTADO SUPERVISIÓN ---\n");
            sb.append("  No. Supervisión: ").append(ultimaSupervision.getNoSupervision()).append("\n");
            sb.append("  % Avance declarado: ").append(ultimaSupervision.getPorcentajeAvance() != null ? ultimaSupervision.getPorcentajeAvance() : 0).append("%\n");
            if (informesRegistrados > 0) {
                sb.append("  Informe de actividades: CARGADO (").append(informesRegistrados).append(")\n");
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

    public List<ContratoResumenDTO> calcularResumenBatch(List<ContratoResumenProyeccion> contratos) {
        List<String> noContratos = contratos.stream()
                .map(ContratoResumenProyeccion::getNoContrato)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<CtTRazabilidad> todasRazabilidades = trazabilidadRepository.findUltimaPorContratos(noContratos);
        Map<String, CtTRazabilidad> trazabilidadMap = todasRazabilidades.stream()
                .collect(Collectors.toMap(CtTRazabilidad::getNoContrato, r -> r, (a, b) -> a));

        Map<String, UltimaSupervision> supervisiones = supervisionJdbcRepository.ultimaPorContratos(noContratos);
        Map<Long, String> nombresSupervisor = supervisorRepository.nombresPorId();

        Map<String, Integer> cuentasMap = informeActividadRepository.contarPorContratos(noContratos);

        List<InformeActividadRow> informes = informeActividadRepository.listarPorContratos(noContratos);
        Map<String, List<InformeActividadRow>> informesMap = informes.stream()
                .filter(i -> i.noContrato() != null)
                .collect(Collectors.groupingBy(InformeActividadRow::noContrato));

        List<CtTRazabilidad> trazasCuentas = trazabilidadRepository.findPorInformeDeContratos(noContratos);
        Map<Long, List<CtTRazabilidad>> trazasPorInforme = trazasCuentas.stream()
                .filter(t -> t.getIdInformeActividad() != null)
                .collect(Collectors.groupingBy(CtTRazabilidad::getIdInformeActividad));

        List<ContratoResumenDTO> resultados = new ArrayList<>();
        LocalDate hoy = LocalDate.now();

        for (ContratoResumenProyeccion contrato : contratos) {
            ContratoResumenDTO dto = new ContratoResumenDTO();
            dto.setId(contrato.getId());
            dto.setNoContrato(contrato.getNoContrato());
            dto.setContratista(contrato.getContratista());
            dto.setDependencia(contrato.getDependencia());
            dto.setFechaInicio(contrato.getFechaInicio());
            dto.setFechaFin(contrato.getFechaFin());

            int cuentasRegistradas = cuentasMap.getOrDefault(contrato.getNoContrato(), 0);

            UltimaSupervision supervision = supervisiones.getOrDefault(contrato.getNoContrato(),
                    UltimaSupervision.SIN_SUPERVISION);
            dto.setTotalSupervisiones(supervision.total());
            dto.setTotalSupervisionesEsperadas(12);
            if (supervision.porcentajeAvance() != null || supervision.idSupervisor() != null) {
                short declarado = supervision.porcentajeAvance() != null ? supervision.porcentajeAvance() : 0;
                dto.setAvanceDeclarado(declarado);
                dto.setPorcentajeAvance(cuentasRegistradas > 0 ? declarado : 0);
                if (supervision.idSupervisor() != null) {
                    dto.setSupervisor(nombresSupervisor.get(supervision.idSupervisor()));
                }
            }

            dto.setInformeCargado(cuentasRegistradas > 0);
            LocalDate inicio = parseFechaContrato(contrato.getFechaInicio());
            LocalDate fin = parseFechaContrato(contrato.getFechaFin());
            int cuentasEsperadas = mesesEsperados(inicio, fin);
            int cuentasExigibles = calcularCuentasExigibles(inicio, fin, hoy, cuentasEsperadas);
            dto.setCuentasRegistradas(cuentasRegistradas);
            dto.setCuentasEsperadas(cuentasEsperadas);
            dto.setCuentasExigibles(cuentasExigibles);
            dto.setCuentasEnMora(Math.max(0, cuentasExigibles - cuentasRegistradas));

            CtTRazabilidad traz = trazabilidadMap.get(contrato.getNoContrato());
            if (traz != null) {
                dto.setIdEstadoActual(traz.getIdEstado());
                dto.setEstadoActual(resolverEstado(traz.getIdEstado()));
                dto.setDescripcion(traz.getDescripcion());
                dto.setFechaEstado(traz.getFecha() != null ? traz.getFecha().toString() : null);
                dto.setSiguientePaso(siguientesPasosMap.get(traz.getIdEstado()));
            } else {
                dto.setIdEstadoActual(0);
                dto.setEstadoActual("SIN INICIO - Contratista debe cargar informe de actividades");
            }

            List<InformeActividadRow> informesContrato = informesMap.getOrDefault(contrato.getNoContrato(), List.of());
            Comparator<InformeActividadRow> porActividad = Comparator
                    .comparingLong((InformeActividadRow i) -> ultimaTrazaId(trazasPorInforme.get(i.id())))
                    .thenComparingLong(InformeActividadRow::id);
            long idCuentaActiva = informesContrato.stream()
                    .filter(i -> cuentaEnProceso(trazasPorInforme.get(i.id())))
                    .max(porActividad)
                    .or(() -> informesContrato.stream().max(porActividad))
                    .map(InformeActividadRow::id)
                    .orElse(-1L);

            List<CuentaDetalleDTO> cuentasDetalle = new ArrayList<>();
            for (InformeActividadRow informe : informesContrato) {
                cuentasDetalle.add(construirCuenta(
                        informe,
                        trazasPorInforme.getOrDefault(informe.id(), List.of()),
                        informe.id() == idCuentaActiva
                ));
            }
            dto.setCuentasDetalle(cuentasDetalle);

            resultados.add(dto);
        }

        return resultados;
    }

    private String resolverEstado(int idEstado) {
        return estadosMap.getOrDefault(idEstado, "Estado " + idEstado);
    }

    private static LocalDate parseFechaContrato(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            LocalDate fecha = LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length())));
            return (fecha.getYear() >= 1900 && fecha.getYear() <= 2100) ? fecha : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static int mesesEsperados(LocalDate inicio, LocalDate fin) {
        if (inicio == null || fin == null || fin.isBefore(inicio)) return 0;
        Period periodo = Period.between(inicio, fin);
        int meses = periodo.getYears() * 12 + periodo.getMonths();
        if (periodo.getDays() > 0) meses += 1;
        return Math.max(1, meses);
    }

    private static int calcularCuentasExigibles(LocalDate inicio, LocalDate fin, LocalDate hoy, int esperadas) {
        if (inicio == null || hoy == null || esperadas <= 0 || hoy.isBefore(inicio)) return 0;
        int exigibles = 0;
        for (int k = 0; k < esperadas; k++) {
            LocalDate cierre = inicio.plusMonths(k + 1L).minusDays(1);
            if (fin != null && cierre.isAfter(fin)) cierre = fin;
            if (cierre.isAfter(hoy)) break;
            exigibles++;
        }
        return exigibles;
    }

    private static long ultimaTrazaId(List<CtTRazabilidad> trazas) {
        if (trazas == null || trazas.isEmpty()) return 0L;
        CtTRazabilidad ultima = trazas.get(trazas.size() - 1);
        return ultima.getId() != null ? ultima.getId() : 0L;
    }

    private static boolean cuentaEnProceso(List<CtTRazabilidad> trazas) {
        if (trazas == null || trazas.isEmpty()) return true;
        return trazas.get(trazas.size() - 1).getIdEstado() != 19;
    }

    private CuentaDetalleDTO construirCuenta(InformeActividadRow informe,
                                             List<CtTRazabilidad> trazas,
                                             boolean activa) {
        CuentaDetalleDTO dto = new CuentaDetalleDTO();
        dto.setIdInformeActividad(informe.id());
        dto.setNoInforme(informe.noInforme());
        dto.setNumInforme(informe.numInforme());
        dto.setTipoInforme(informe.tipoInforme());
        dto.setRequiereSecop(informe.requiereSecop());
        dto.setFirmado(informe.firmado());
        dto.setFechaInicio(informe.fechaInicio() != null ? informe.fechaInicio().toString() : null);
        dto.setFechaFin(informe.fechaFin() != null ? informe.fechaFin().toString() : null);
        dto.setActiva(activa);

        List<CuentaPasoDTO> pasos = new ArrayList<>();
        for (CtTRazabilidad traza : trazas) {
            CuentaPasoDTO paso = new CuentaPasoDTO();
            paso.setIdEstado(traza.getIdEstado());
            paso.setEstado(resolverEstado(traza.getIdEstado()));
            paso.setFecha(traza.getFecha() != null ? traza.getFecha().toString() : null);
            paso.setDescripcion(traza.getDescripcion());

            int ultimo = pasos.isEmpty() ? -1 : pasos.get(pasos.size() - 1).getIdEstado();
            if (ultimo == traza.getIdEstado()) {
                pasos.set(pasos.size() - 1, paso);
            } else {
                pasos.add(paso);
            }
        }
        dto.setPasos(pasos);

        if (!trazas.isEmpty()) {
            CtTRazabilidad ultima = trazas.get(trazas.size() - 1);
            dto.setIdEstadoActual(ultima.getIdEstado());
            dto.setEstadoActual(resolverEstado(ultima.getIdEstado()));
            dto.setFechaEstado(ultima.getFecha() != null ? ultima.getFecha().toString() : null);
            dto.setDescripcionEstado(ultima.getDescripcion());
            dto.setSiguientePaso(siguientesPasosMap.get(ultima.getIdEstado()));
        } else {
            dto.setIdEstadoActual(1);
            dto.setEstadoActual(resolverEstado(1));
            dto.setSiguientePaso(siguientesPasosMap.get(1));
        }

        return dto;
    }
}
