package com.sgcc.seguimientocuentas.contratos.domain.model;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaDetalleDTO;
import com.sgcc.seguimientocuentas.common.dto.CuentaPasoDTO;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.InformeActividadRow;
import com.sgcc.seguimientocuentas.contratos.domain.model.CtTRazabilidad;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Estado en memoria de un solo contrato: lo que dice la base al cargar y los parches que van
 * llegando por CDC. La derivación de los campos derivados (mora, avance, detalle de cuentas) vive
 * aqui, asi que el arranque y el evento CDC calculan exactamente lo mismo.
 */
public class FichaContrato {

    private static final int ESTADO_APROBADO = 19;
    private static final int SUPERVISIONES_ESPERADAS = 12;

    private final ContratoResumenDTO dto = new ContratoResumenDTO();
    private final Map<Long, InformeActividadRow> informes = new LinkedHashMap<>();
    private final Map<Long, List<CtTRazabilidad>> trazasPorInforme = new LinkedHashMap<>();

    private CtTRazabilidad ultimaTraza;
    private int totalSupervisiones;
    private Short avanceDeclarado;
    private Long idSupervisor;

    public FichaContrato(Long id, String noContrato, String contratista, String dependencia,
                         String fechaInicio, String fechaFin) {
        dto.setId(id);
        dto.setNoContrato(noContrato);
        dto.setContratista(contratista);
        dto.setDependencia(dependencia);
        dto.setFechaInicio(fechaInicio);
        dto.setFechaFin(fechaFin);
        dto.setTotalSupervisionesEsperadas(SUPERVISIONES_ESPERADAS);
    }

    public String noContrato() {
        return dto.getNoContrato();
    }

    public ContratoResumenDTO dto() {
        return dto;
    }

    public Long idContratoSap() {
        return dto.getId();
    }

    /** El evento de la tabla maestra trae la fila completa: los campos maestros se reemplazan tal cual. */
    public void actualizarMaestro(String contratista, String dependencia, String fechaInicio, String fechaFin) {
        dto.setContratista(contratista);
        dto.setDependencia(dependencia);
        dto.setFechaInicio(fechaInicio);
        dto.setFechaFin(fechaFin);
    }

    public void setSupervision(int totalSupervisiones, Short avanceDeclarado, Long idSupervisor) {
        this.totalSupervisiones = totalSupervisiones;
        this.avanceDeclarado = avanceDeclarado;
        this.idSupervisor = idSupervisor;
    }

    public void ponerInforme(InformeActividadRow informe) {
        informes.put(informe.id(), informe);
    }

    public void quitarInforme(long idInforme) {
        informes.remove(idInforme);
        trazasPorInforme.remove(idInforme);
    }

    /** Los ids que la ficha conoce: sirven para resolver una baja cuyo evento solo trae la clave primaria. */
    public List<Long> idsInformes() {
        return List.copyOf(informes.keySet());
    }

    public List<Long> idsTrazas() {
        return trazasPorInforme.values().stream()
                .flatMap(List::stream)
                .map(CtTRazabilidad::getId)
                .filter(Objects::nonNull)
                .toList();
    }

    /** Las trazas de un informe: al borrarlo hay que borrar tambien su rastro del indice inverso. */
    public List<Long> idsTrazasDe(long idInforme) {
        List<CtTRazabilidad> trazas = trazasPorInforme.get(idInforme);
        if (trazas == null) {
            return List.of();
        }
        return trazas.stream().map(CtTRazabilidad::getId).filter(Objects::nonNull).toList();
    }

    /** Inserta o reemplaza la traza manteniendo el orden ascendente por id, que es el del recorrido. */
    public void ponerTraza(long id, String noContrato, int idEstado, Long idInforme,
                           LocalDateTime fecha, String descripcion) {
        CtTRazabilidad traza = new CtTRazabilidad();
        traza.setId(id);
        traza.setNoContrato(noContrato);
        traza.setIdEstado(idEstado);
        traza.setIdInformeActividad(idInforme);
        traza.setFecha(fecha);
        traza.setDescripcion(descripcion);
        ponerTraza(traza);
    }

    public void ponerTraza(CtTRazabilidad traza) {
        Long id = traza.getId();
        if (id == null) {
            return;
        }
        if (ultimaTraza == null || ultimaTraza.getId() == null || id > ultimaTraza.getId()) {
            ultimaTraza = traza;
        }
        Long idInforme = traza.getIdInformeActividad();
        if (idInforme == null) {
            return;
        }
        List<CtTRazabilidad> trazas = trazasPorInforme.computeIfAbsent(idInforme, k -> new ArrayList<>());
        for (int i = 0; i < trazas.size(); i++) {
            CtTRazabilidad existente = trazas.get(i);
            if (id.equals(existente.getId())) {
                trazas.set(i, traza);
                return;
            }
            if (id < existente.getId()) {
                trazas.add(i, traza);
                return;
            }
        }
        trazas.add(traza);
    }

    public void quitarTraza(long idTraza) {
        for (List<CtTRazabilidad> trazas : trazasPorInforme.values()) {
            trazas.removeIf(t -> t.getId() != null && t.getId() == idTraza);
        }
        if (ultimaTraza != null && ultimaTraza.getId() != null && ultimaTraza.getId() == idTraza) {
            ultimaTraza = trazasPorInforme.values().stream()
                    .flatMap(List::stream)
                    .max(Comparator.comparingLong(t -> t.getId() == null ? 0L : t.getId()))
                    .orElse(null);
        }
    }

    public void recalcular(Catalogos catalogos, LocalDate hoy) {
        int registradas = informes.size();
        LocalDate inicio = parseFechaContrato(dto.getFechaInicio());
        LocalDate fin = parseFechaContrato(dto.getFechaFin());
        int esperadas = mesesEsperados(inicio, fin);
        int exigibles = cuentasExigibles(inicio, fin, hoy, esperadas);

        dto.setCuentasRegistradas(registradas);
        dto.setCuentasEsperadas(esperadas);
        dto.setCuentasExigibles(exigibles);
        dto.setCuentasEnMora(Math.max(0, exigibles - registradas));
        dto.setInformeCargado(registradas > 0);

        dto.setTotalSupervisiones(totalSupervisiones);
        short declarado = avanceDeclarado != null ? avanceDeclarado : 0;
        dto.setAvanceDeclarado(declarado);
        dto.setPorcentajeAvance(registradas > 0 ? declarado : (short) 0);
        dto.setSupervisor(idSupervisor == null ? null : catalogos.nombreSupervisor(idSupervisor));

        if (ultimaTraza != null) {
            dto.setIdEstadoActual(ultimaTraza.getIdEstado());
            dto.setEstadoActual(catalogos.nombreEstado(ultimaTraza.getIdEstado()));
            dto.setDescripcion(ultimaTraza.getDescripcion());
            dto.setFechaEstado(ultimaTraza.getFecha() != null ? ultimaTraza.getFecha().toString() : null);
            dto.setSiguientePaso(catalogos.siguientePaso(ultimaTraza.getIdEstado()));
        } else {
            dto.setIdEstadoActual(0);
            dto.setEstadoActual("SIN INICIO - Contratista debe cargar informe de actividades");
            dto.setDescripcion(null);
            dto.setFechaEstado(null);
            dto.setSiguientePaso(null);
        }

        long idCuentaActiva = informes.values().stream()
                .filter(informe -> cuentaEnProceso(trazasPorInforme.get(informe.id())))
                .max(this::compararPorActividad)
                .or(() -> informes.values().stream().max(this::compararPorActividad))
                .map(InformeActividadRow::id)
                .orElse(-1L);

        List<CuentaDetalleDTO> detalle = new ArrayList<>(informes.size());
        for (InformeActividadRow informe : informes.values()) {
            detalle.add(construirCuenta(informe,
                    trazasPorInforme.getOrDefault(informe.id(), List.of()),
                    informe.id() == idCuentaActiva,
                    catalogos));
        }
        dto.setCuentasDetalle(detalle);
    }

    private int compararPorActividad(InformeActividadRow a, InformeActividadRow b) {
        long trazaA = ultimaTrazaId(trazasPorInforme.get(a.id()));
        long trazaB = ultimaTrazaId(trazasPorInforme.get(b.id()));
        if (trazaA != trazaB) {
            return Long.compare(trazaA, trazaB);
        }
        return Long.compare(a.id(), b.id());
    }

    private static long ultimaTrazaId(List<CtTRazabilidad> trazas) {
        if (trazas == null || trazas.isEmpty()) {
            return 0L;
        }
        CtTRazabilidad ultima = trazas.get(trazas.size() - 1);
        return ultima.getId() != null ? ultima.getId() : 0L;
    }

    private static boolean cuentaEnProceso(List<CtTRazabilidad> trazas) {
        if (trazas == null || trazas.isEmpty()) {
            return true;
        }
        return trazas.get(trazas.size() - 1).getIdEstado() != ESTADO_APROBADO;
    }

    private static CuentaDetalleDTO construirCuenta(InformeActividadRow informe,
                                                    List<CtTRazabilidad> trazas,
                                                    boolean activa,
                                                    Catalogos catalogos) {
        CuentaDetalleDTO cuenta = new CuentaDetalleDTO();
        cuenta.setIdInformeActividad(informe.id());
        cuenta.setNoInforme(informe.noInforme());
        cuenta.setNumInforme(informe.numInforme());
        cuenta.setTipoInforme(informe.tipoInforme());
        cuenta.setRequiereSecop(informe.requiereSecop());
        cuenta.setFirmado(informe.firmado());
        cuenta.setFechaInicio(informe.fechaInicio() != null ? informe.fechaInicio().toString() : null);
        cuenta.setFechaFin(informe.fechaFin() != null ? informe.fechaFin().toString() : null);
        cuenta.setActiva(activa);

        List<CuentaPasoDTO> pasos = new ArrayList<>();
        for (CtTRazabilidad traza : trazas) {
            CuentaPasoDTO paso = new CuentaPasoDTO();
            paso.setIdEstado(traza.getIdEstado());
            paso.setEstado(catalogos.nombreEstado(traza.getIdEstado()));
            paso.setFecha(traza.getFecha() != null ? traza.getFecha().toString() : null);
            paso.setDescripcion(traza.getDescripcion());

            int ultimo = pasos.isEmpty() ? -1 : pasos.get(pasos.size() - 1).getIdEstado();
            if (ultimo == traza.getIdEstado()) {
                pasos.set(pasos.size() - 1, paso);
            } else {
                pasos.add(paso);
            }
        }
        cuenta.setPasos(pasos);

        if (!trazas.isEmpty()) {
            CtTRazabilidad ultima = trazas.get(trazas.size() - 1);
            cuenta.setIdEstadoActual(ultima.getIdEstado());
            cuenta.setEstadoActual(catalogos.nombreEstado(ultima.getIdEstado()));
            cuenta.setFechaEstado(ultima.getFecha() != null ? ultima.getFecha().toString() : null);
            cuenta.setDescripcionEstado(ultima.getDescripcion());
            cuenta.setSiguientePaso(catalogos.siguientePaso(ultima.getIdEstado()));
        } else {
            cuenta.setIdEstadoActual(1);
            cuenta.setEstadoActual(catalogos.nombreEstado(1));
            cuenta.setSiguientePaso(catalogos.siguientePaso(1));
        }

        return cuenta;
    }

    static LocalDate parseFechaContrato(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            LocalDate fecha = LocalDate.parse(trimmed.substring(0, Math.min(10, trimmed.length())));
            return (fecha.getYear() >= 1900 && fecha.getYear() <= 2100) ? fecha : null;
        } catch (Exception e) {
            return null;
        }
    }

    static int mesesEsperados(LocalDate inicio, LocalDate fin) {
        if (inicio == null || fin == null || fin.isBefore(inicio)) {
            return 0;
        }
        Period periodo = Period.between(inicio, fin);
        int meses = periodo.getYears() * 12 + periodo.getMonths();
        if (periodo.getDays() > 0) {
            meses += 1;
        }
        return Math.max(1, meses);
    }

    static int cuentasExigibles(LocalDate inicio, LocalDate fin, LocalDate hoy, int esperadas) {
        if (inicio == null || hoy == null || esperadas <= 0 || hoy.isBefore(inicio)) {
            return 0;
        }
        int exigibles = 0;
        for (int k = 0; k < esperadas; k++) {
            LocalDate cierre = inicio.plusMonths(k + 1L).minusDays(1);
            if (fin != null && cierre.isAfter(fin)) {
                cierre = fin;
            }
            if (cierre.isAfter(hoy)) {
                break;
            }
            exigibles++;
        }
        return exigibles;
    }
}
