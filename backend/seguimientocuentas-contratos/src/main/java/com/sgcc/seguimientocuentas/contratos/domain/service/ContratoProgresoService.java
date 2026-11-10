package com.sgcc.seguimientocuentas.contratos.domain.service;

import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtPEstadoRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTContratoSapRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTRazabilidadRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CtTSupervisionRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.ContratoResumenProyeccion;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.InformeActividadJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.InformeActividadRow;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisionJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisionJdbcRepository.UltimaSupervision;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisorJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.domain.model.Catalogos;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtPEstado;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTContratoSap;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTRazabilidad;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTSupervision;
import com.sgcc.seguimientocuentas.contratos.domain.model.FichaContrato;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lee la base y la traduce a fichas en memoria. Es el unico sitio que toca SQL para el resumen:
 * se llama al arrancar, cuando el CDC menciona un contrato que no esta en memoria, y cuando el
 * motor Debezium se reconecta. El resto del tiempo el CDC parcha las fichas sin consultar nada.
 */
@Service
public class ContratoProgresoService {

    private static final Logger log = LoggerFactory.getLogger(ContratoProgresoService.class);

    private static final Map<Integer, String> SIGUIENTES_PASOS = Map.ofEntries(
            Map.entry(1, "Enviar informe de actividades a revisión"),
            Map.entry(2, "Supervisor revisa y aprueba o rechaza"),
            Map.entry(3, "Contratista corrige y reenvía el informe"),
            Map.entry(4, "Firmar informe de actividades"),
            Map.entry(5, "Solicitar pantallas SECOP y firmar"),
            Map.entry(6, "Cargar pantallas SECOP"),
            Map.entry(7, "Supervisor aprueba o rechaza SECOP"),
            Map.entry(8, "Corregir pantallas SECOP"),
            Map.entry(9, "Registrar supervisión"),
            Map.entry(10, "Contratista corrige y reenvía el informe"),
            Map.entry(11, "Crear RAS"),
            Map.entry(12, "Enviar informe al enlace"),
            Map.entry(13, "Enviar informe al área jurídica"),
            Map.entry(14, "Enviar informe al usuario MM"),
            Map.entry(15, "Enviar informe al usuario FI"),
            Map.entry(16, "Enviar informe al ordenador del gasto"),
            Map.entry(17, "Enviar informe a tesorería"),
            Map.entry(18, "Aprobación final por tesorería"),
            Map.entry(19, "Proceso completado")
    );

    private final CtTContratoSapRepository contratoSapRepository;
    private final CtTSupervisionRepository supervisionRepository;
    private final SupervisionJdbcRepository supervisionJdbcRepository;
    private final CtTRazabilidadRepository trazabilidadRepository;
    private final CtPEstadoRepository estadoRepository;
    private final InformeActividadJdbcRepository informeActividadRepository;
    private final SupervisorJdbcRepository supervisorRepository;

    private final Map<Integer, String> estadosMap = new ConcurrentHashMap<>();
    private final Map<Long, String> nombresSupervisor = new ConcurrentHashMap<>();

    public ContratoProgresoService(CtTContratoSapRepository contratoSapRepository,
                                    CtTSupervisionRepository supervisionRepository,
                                    SupervisionJdbcRepository supervisionJdbcRepository,
                                    CtTRazabilidadRepository trazabilidadRepository,
                                    CtPEstadoRepository estadoRepository,
                                    InformeActividadJdbcRepository informeActividadRepository,
                                    SupervisorJdbcRepository supervisorRepository) {
        this.contratoSapRepository = contratoSapRepository;
        this.supervisionRepository = supervisionRepository;
        this.supervisionJdbcRepository = supervisionJdbcRepository;
        this.trazabilidadRepository = trazabilidadRepository;
        this.estadoRepository = estadoRepository;
        this.informeActividadRepository = informeActividadRepository;
        this.supervisorRepository = supervisorRepository;
    }

    @PostConstruct
    public void init() {
        recargarEstados();
        recargarSupervisores();
        log.info("Catalogos listos: {} estados y {} supervisores", estadosMap.size(), nombresSupervisor.size());
    }

    public Catalogos catalogos() {
        return new Catalogos(Map.copyOf(estadosMap), SIGUIENTES_PASOS, Map.copyOf(nombresSupervisor));
    }

    /** Texto de los estados: cambia rara vez, y el CDC de ct_p_estado avisa cuando cambia. */
    public void recargarEstados() {
        try {
            Map<Integer, String> leidos = new LinkedHashMap<>();
            for (CtPEstado estado : estadoRepository.findAll()) {
                if (estado.getId() != null && estado.getDescripcion() != null) {
                    leidos.put(estado.getId(), estado.getDescripcion());
                }
            }
            if (!leidos.isEmpty()) {
                estadosMap.clear();
                estadosMap.putAll(leidos);
            }
        } catch (Exception e) {
            log.warn("No se pudo leer ct_p_estado: {}", e.getMessage());
        }
    }

    public void recargarSupervisores() {
        try {
            nombresSupervisor.clear();
            nombresSupervisor.putAll(supervisorRepository.nombresPorId());
        } catch (Exception e) {
            log.warn("No se pudo leer t_usuarios: {}", e.getMessage());
        }
    }

    /**
     * Reconstruye todas las fichas desde la base. Es la unica consulta pesada del sistema y ocurre
     * dos veces en la vida del proceso: al arrancar y cuando el motor CDC vuelve a conectarse.
     */
    public List<FichaContrato> cargarFichas() {
        long inicio = System.currentTimeMillis();
        Map<String, FichaContrato> fichas = new LinkedHashMap<>();
        for (ContratoResumenProyeccion contrato : contratoSapRepository.findContratosResumen()) {
            fichas.put(contrato.getNoContrato(), ficha(contrato));
        }

        for (CtTRazabilidad traza : trazabilidadRepository.findUltimaDeTodos()) {
            anadirTraza(fichas, traza);
        }
        for (CtTRazabilidad traza : trazabilidadRepository.findPorInformeDeTodos()) {
            anadirTraza(fichas, traza);
        }
        for (InformeActividadRow informe : informeActividadRepository.listarTodos()) {
            FichaContrato ficha = fichas.get(informe.noContrato());
            if (ficha != null) {
                ficha.ponerInforme(informe);
            }
        }
        supervisionJdbcRepository.ultimaDeTodos().forEach((noContrato, supervision) -> {
            FichaContrato ficha = fichas.get(noContrato);
            if (ficha != null) {
                ficha.setSupervision(supervision.total(), supervision.porcentajeAvance(), supervision.idSupervisor());
            }
        });

        Catalogos catalogos = catalogos();
        LocalDate hoy = LocalDate.now();
        List<FichaContrato> resultado = new ArrayList<>(fichas.size());
        for (FichaContrato ficha : fichas.values()) {
            synchronized (ficha) {
                ficha.recalcular(catalogos, hoy);
            }
            resultado.add(ficha);
        }
        log.info("Fichas cargadas desde la base: {} contratos en {} ms",
                resultado.size(), System.currentTimeMillis() - inicio);
        return resultado;
    }

    /**
     * Ficha de un contrato que el CDC menciona y todavia no esta en memoria (un contrato recién
     * creado, o uno que todavia no existia cuando se lleno el indice). Cuatro consultas chicas.
     */
    public FichaContrato cargarFicha(String noContrato) {
        Optional<CtTContratoSap> contrato = contratoSapRepository.findByNoContrato(noContrato);
        if (contrato.isEmpty() || !apareceEnResumen(contrato.get().getContratista())) {
            return null;
        }

        CtTContratoSap origen = contrato.get();
        FichaContrato ficha = new FichaContrato(origen.getId(), origen.getNoContrato(), origen.getContratista(),
                origen.getDependencia(), origen.getFechaInicio(), origen.getFechaFin());
        for (CtTRazabilidad traza : trazabilidadRepository.findByNoContratoOrderByIdAsc(noContrato)) {
            ficha.ponerTraza(traza);
        }
        for (InformeActividadRow informe : informeActividadRepository.listarPorContrato(noContrato)) {
            ficha.ponerInforme(informe);
        }
        UltimaSupervision supervision = supervisionJdbcRepository
                .ultimaDeContratos(List.of(noContrato))
                .get(noContrato);
        if (supervision != null) {
            ficha.setSupervision(supervision.total(), supervision.porcentajeAvance(), supervision.idSupervisor());
        }
        synchronized (ficha) {
            ficha.recalcular(catalogos(), LocalDate.now());
        }
        return ficha;
    }

    /** Refresca la agregacion de supervision de unos pocos contratos; es la unica que no cabe en memoria. */
    public Map<String, UltimaSupervision> refrescarSupervisiones(Collection<String> noContratos) {
        return supervisionJdbcRepository.ultimaDeContratos(noContratos);
    }

    private static void anadirTraza(Map<String, FichaContrato> fichas, CtTRazabilidad traza) {
        FichaContrato ficha = fichas.get(traza.getNoContrato());
        if (ficha != null) {
            ficha.ponerTraza(traza);
        }
    }

    private static FichaContrato ficha(ContratoResumenProyeccion contrato) {
        return new FichaContrato(contrato.getId(), contrato.getNoContrato(), contrato.getContratista(),
                contrato.getDependencia(), contrato.getFechaInicio(), contrato.getFechaFin());
    }

    /** Mismo filtro que la consulta del resumen: sin contratista no hay contrato que mostrar. */
    public static boolean apareceEnResumen(String contratista) {
        return contratista != null && !contratista.isBlank();
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

            String pasoSiguiente = SIGUIENTES_PASOS.get(ultimoRegistro.getIdEstado());
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

        sb.append("\n========================================\n");

        return sb.toString();
    }

    private String resolverEstado(int idEstado) {
        return estadosMap.getOrDefault(idEstado, "Estado " + idEstado);
    }
}
