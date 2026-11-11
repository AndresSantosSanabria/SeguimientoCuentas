package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.common.dto.ContratoResumenDTO;
import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.InformeActividadRow;
import com.sgcc.seguimientocuentas.contratos.domain.model.Catalogos;
import com.sgcc.seguimientocuentas.contratos.domain.model.FichaContrato;
import com.sgcc.seguimientocuentas.contratos.domain.service.ContratoProgresoService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * El resumen completo de los contratos, vivo y en memoria. La base se lee una sola vez al arrancar
 * (y cuando el motor CDC se reconecta); despues de eso cada evento de Debezium parchea la ficha de
 * su contrato y sube la version, asi que nadie tiene por que volver a consultar.
 *
 * Unica excepcion: ct_t_supervision tiene 222.000 filas y su agregacion no cabe en memoria, asi que
 * los contratos mencionados por sus eventos se anotan en una lista de pendientes y se refrescan con
 * una consulta puntual, una vez por ventana de publicacion, usando el indice unico (no_contrato, no_supervision).
 */
@Service
public class ContratoResumenIndex {

    /** @param version la del indice en el momento de armar la lista; si subio, el contenido es anterior a ese numero. */
    public record Publicacion(long version, List<ContratoResumenDTO> contratos) {}

    private static final Logger log = LoggerFactory.getLogger(ContratoResumenIndex.class);

    /** Mismo orden que la consulta del arranque, para que el ETag no cambie sin que cambie nada. */
    private static final Comparator<ContratoResumenDTO> ORDEN_PUBLICACION =
            Comparator.comparing(ContratoResumenDTO::getFechaInicio, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ContratoResumenDTO::getId, Comparator.nullsLast(Comparator.reverseOrder()));

    private final ContratoProgresoService progresoService;

    private final Map<String, FichaContrato> fichas = new ConcurrentHashMap<>();
    private final Map<Long, String> contratosPorId = new ConcurrentHashMap<>();
    private final Map<Long, String> contratosPorTraza = new ConcurrentHashMap<>();
    private final Map<Long, String> contratosPorInforme = new ConcurrentHashMap<>();
    private final Set<String> descartados = ConcurrentHashMap.newKeySet();
    private final AtomicReference<LocalDate> dia = new AtomicReference<>();
    private final AtomicLong version = new AtomicLong();

    private volatile Catalogos catalogos;

    public ContratoResumenIndex(ContratoProgresoService progresoService) {
        this.progresoService = progresoService;
    }

    /** Tablas cuyos eventos el indice sabe aprovechar; si Debezium no monitorea una, el indice se desfasa. */
    public static List<String> tablasRequeridas() {
        return List.of(
                "contratacion.ct_t_contrato_sap",
                "contratistas.ct_t_trazabilidad",
                "contratistas.ct_t_informe_actividades",
                "contratacion.ct_t_supervision",
                "contratistas.ct_p_estado",
                "public.t_usuarios",
                "contratistas.ct_t_informe_documento",
                "ras.ct_t_fondos",
                "contratacion.ct_pago");
    }

    @PostConstruct
    public void cargar() {
        List<FichaContrato> cargadas = progresoService.cargarFichas();
        fichas.clear();
        contratosPorId.clear();
        contratosPorTraza.clear();
        contratosPorInforme.clear();
        descartados.clear();
        for (FichaContrato ficha : cargadas) {
            indexar(ficha);
        }
        catalogos = progresoService.catalogos();
        dia.set(LocalDate.now());
        version.incrementAndGet();
        log.info("Indice del resumen en memoria: {} contratos, sin consultas periodicas", fichas.size());
    }

    /**
     * Coloca una ficha y anota de que contrato es cada traza y cada informe que trae. Esas dos tablas
     * inversas son las que permiten entender un DELETE: con la identidad de replica por defecto, el
     * evento de borrado solo entrega la clave primaria de la fila eliminada.
     */
    private void indexar(FichaContrato ficha) {
        String noContrato = ficha.noContrato();
        fichas.put(noContrato, ficha);
        if (ficha.idContratoSap() != null) {
            contratosPorId.put(ficha.idContratoSap(), noContrato);
        }
        synchronized (ficha) {
            for (Long idTraza : ficha.idsTrazas()) {
                contratosPorTraza.put(idTraza, noContrato);
            }
            for (Long idInforme : ficha.idsInformes()) {
                contratosPorInforme.put(idInforme, noContrato);
            }
        }
    }

    public long version() {
        return version.get();
    }

    public int tamano() {
        return fichas.size();
    }

    /** ct_pago apunta a la fila maestra por id, nunca por numero de contrato: esta tabla evita consultar la base. */
    public String contratoPorIdSap(long idContratoSap) {
        return contratosPorId.get(idContratoSap);
    }

    public FichaContrato buscar(String noContrato) {
        return fichas.get(noContrato);
    }

    public BigDecimal valorTotal(String noContrato) {
        FichaContrato ficha = fichas.get(noContrato);
        return ficha == null ? null : ficha.valorTotal();
    }

    public List<ContratoResumenDTO> contratosDelSupervisor(long idSupervisor) {
        return fichas.values().stream()
                .filter(ficha -> ficha.idSupervisorActual() != null && ficha.idSupervisorActual() == idSupervisor)
                .map(FichaContrato::dto)
                .sorted(ORDEN_PUBLICACION)
                .toList();
    }

    public List<ContratoSupervisorDTO> contratosCruzadosDeSecretarias(Set<String> secretarias) {
        Set<String> normalizadas = secretarias.stream().map(AmbitoUsuario::normalizar)
                .filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        Set<Long> supervisoresLocales = fichas.values().stream()
                .filter(f -> normalizadas.contains(AmbitoUsuario.normalizar(f.dto().getDependencia())))
                .map(FichaContrato::idSupervisorActual).filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        return fichas.values().stream()
                .filter(f -> f.idSupervisorActual() != null && supervisoresLocales.contains(f.idSupervisorActual()))
                .filter(f -> !normalizadas.contains(AmbitoUsuario.normalizar(f.dto().getDependencia())))
                .map(f -> new ContratoSupervisorDTO(f.dto().getSupervisor(), f.dto()))
                .toList();
    }

    public boolean supervisadoPorEquipoSecretarias(String noContrato, Set<String> secretarias) {
        FichaContrato objetivo = fichas.get(noContrato);
        if (objetivo == null || objetivo.idSupervisorActual() == null) return false;
        Long idSupervisor = objetivo.idSupervisorActual();
        return fichas.values().stream().anyMatch(f -> idSupervisor.equals(f.idSupervisorActual())
                && secretarias.stream().map(AmbitoUsuario::normalizar).anyMatch(s ->
                java.util.Objects.equals(s, AmbitoUsuario.normalizar(f.dto().getDependencia()))));
    }

    public record ContratoSupervisorDTO(String supervisor, ContratoResumenDTO contrato) {}

    public boolean supervisadoPor(String noContrato, long idSupervisor) {
        FichaContrato ficha = fichas.get(noContrato);
        return ficha != null && ficha.idSupervisorActual() != null && ficha.idSupervisorActual() == idSupervisor;
    }

    /** Los nombres de estado y de supervisor cambian por su cuenta; el CDC avisa cuando ocurre. */
    public void refrescarCatalogos() {
        catalogos = progresoService.catalogos();
        version.incrementAndGet();
    }

    /**
     * La lista ordenada para serializar. Primero se resuelven los refrescos aplazados y despues se lee la
     * version: si un evento llega mientras se arma la lista, la version siguiente publica de nuevo.
     */
    public Publicacion publicar() {
        asegurarDia(LocalDate.now());
        long versionPublicada = version.get();
        List<ContratoResumenDTO> contratos = new ArrayList<>(fichas.size());
        for (FichaContrato ficha : fichas.values()) {
            contratos.add(ficha.dto());
        }
        contratos.sort(ORDEN_PUBLICACION);
        return new Publicacion(versionPublicada, contratos);
    }

    /** Alta o actualizacion de contratacion.ct_t_contrato_sap: el evento trae la fila maestra completa. */
    public void aplicarMaestro(long id, String noContrato, String contratista, String dependencia,
                               String fechaInicio, String fechaFin, BigDecimal valorTotal) {
        if (noContrato == null || noContrato.isBlank()) {
            return;
        }
        contratosPorId.put(id, noContrato);
        if (!ContratoProgresoService.apareceEnResumen(contratista)) {
            darDeBaja(noContrato);
            descartados.add(noContrato);
            return;
        }
        descartados.remove(noContrato);

        FichaContrato ficha = fichas.get(noContrato);
        if (ficha == null) {
            FichaContrato nueva = new FichaContrato(id, noContrato, contratista, dependencia, fechaInicio, fechaFin);
            nueva.actualizarMaestro(contratista, dependencia, fechaInicio, fechaFin, valorTotal);
            indexar(nueva);
        } else {
            synchronized (ficha) {
                ficha.actualizarMaestro(contratista, dependencia, fechaInicio, fechaFin, valorTotal);
            }
            recalcular(ficha);
        }
    }

    /** El borrado de la fila maestra llega con payload.before reducido a su clave primaria. */
    public String aplicarBajaMaestro(long id) {
        String noContrato = contratosPorId.remove(id);
        if (noContrato == null) {
            return null;
        }
        darDeBaja(noContrato);
        return noContrato;
    }

    public void aplicarTrazabilidad(String noContrato, long idTraza, int idEstado, Long idInforme,
                                    LocalDateTime fecha, String descripcion) {
        FichaContrato ficha = asegurarFicha(noContrato);
        if (ficha == null) {
            return;
        }
        synchronized (ficha) {
            ficha.ponerTraza(idTraza, noContrato, idEstado, idInforme, fecha, descripcion);
        }
        contratosPorTraza.put(idTraza, noContrato);
        recalcular(ficha);
    }

    /** @return el contrato al que se le quitó la traza; null si la traza no estaba en memoria. */
    public String aplicarBajaTrazabilidad(long idTraza) {
        String noContrato = contratosPorTraza.remove(idTraza);
        FichaContrato ficha = noContrato == null ? null : fichas.get(noContrato);
        if (ficha == null) {
            return noContrato;
        }
        synchronized (ficha) {
            ficha.quitarTraza(idTraza);
        }
        recalcular(ficha);
        return noContrato;
    }

    public void aplicarInforme(InformeActividadRow informe) {
        FichaContrato ficha = asegurarFicha(informe.noContrato());
        if (ficha == null) {
            return;
        }
        synchronized (ficha) {
            ficha.ponerInforme(informe);
        }
        contratosPorInforme.put(informe.id(), informe.noContrato());
        recalcular(ficha);
    }

    /** @return el contrato al que se le quitó el informe; null si el informe no estaba en memoria. */
    public String aplicarBajaInforme(long idInforme) {
        String noContrato = contratosPorInforme.remove(idInforme);
        FichaContrato ficha = noContrato == null ? null : fichas.get(noContrato);
        if (ficha == null) {
            return noContrato;
        }
        List<Long> trazasDelInforme;
        synchronized (ficha) {
            trazasDelInforme = ficha.idsTrazasDe(idInforme);
            ficha.quitarInforme(idInforme);
        }
        trazasDelInforme.forEach(contratosPorTraza::remove);
        recalcular(ficha);
        return noContrato;
    }

    /**
     * La supervision no se puede derivar en memoria, asi que el evento solo anota el contrato. La consulta
     * puntual se hace al publicar, agrupando todos los anotados en la misma ventana.
     */
    public void aplicarEventoSupervision(String noContrato, boolean alta, boolean baja, Short avance, Long supervisor) {
        FichaContrato ficha = asegurarFicha(noContrato);
        if (ficha == null) {
            return;
        }
        synchronized (ficha) {
            ficha.aplicarEventoSupervision(alta, baja, avance, supervisor);
        }
        recalcular(ficha);
        version.incrementAndGet();
    }

    /** Recuento de exigibles y mora al pasar la medianoche: puro calculo en memoria, sin tocar la base. */
    public void asegurarDia(LocalDate hoy) {
        LocalDate anterior = dia.getAndSet(hoy);
        if (hoy.equals(anterior)) {
            return;
        }
        descartados.clear();
        if (anterior == null) {
            return;
        }
        Catalogos catalogo = catalogos;
        for (FichaContrato ficha : fichas.values()) {
            synchronized (ficha) {
                ficha.recalcular(catalogo, hoy);
            }
        }
        version.incrementAndGet();
        log.info("Dia {} en el indice: exigibles y mora recalculados en memoria", hoy);
    }

    /** Contrato que el CDC menciona y todavia no esta: una carga puntual chica, o una vez, o ninguna. */
    private FichaContrato asegurarFicha(String noContrato) {
        if (noContrato == null || noContrato.isBlank()) {
            return null;
        }
        FichaContrato ficha = fichas.get(noContrato);
        if (ficha != null || descartados.contains(noContrato)) {
            return ficha;
        }
        ficha = progresoService.cargarFicha(noContrato);
        if (ficha == null) {
            descartados.add(noContrato);
            return null;
        }
        indexar(ficha);
        log.info("Carga puntual del contrato {}, mencionado por el CDC y ajeno al indice", noContrato);
        return ficha;
    }

    private void recalcular(FichaContrato ficha) {
        synchronized (ficha) {
            ficha.recalcular(catalogos, hoy());
        }
        version.incrementAndGet();
    }

    private LocalDate hoy() {
        LocalDate actual = dia.get();
        return actual != null ? actual : LocalDate.now();
    }

    /**
     * Saca el contrato del resumen y de todo indice inverso que lo mencione.
     * Sube la version solo si la ficha existia: si no habia nada que quitar, nada cambia afuera.
     */
    private void darDeBaja(String noContrato) {
        FichaContrato ficha = fichas.remove(noContrato);
        contratosPorId.values().remove(noContrato);
        if (ficha == null) {
            return;
        }
        synchronized (ficha) {
            ficha.idsTrazas().forEach(contratosPorTraza::remove);
            ficha.idsInformes().forEach(contratosPorInforme::remove);
        }
        version.incrementAndGet();
    }
}
