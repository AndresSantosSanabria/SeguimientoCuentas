package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.common.dto.CalificacionRiesgoDTO;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CalificacionJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.SupervisorJdbcRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Calificación y riesgo de los contratistas.
 *
 * Ni la calificación ni el riesgo viajan por el CDC, así que se leen del motor por lotes y se
 * guardan un rato en memoria: cambia muy poco y todas las páginas los piden juntos.
 */
@Service
public class CalificacionRiesgoService {

    /** Cuánto vive la lectura antes de volver al motor. */
    private static final Duration VALIDEZ = Duration.ofMinutes(10);

    private final CalificacionJdbcRepository calificacion;
    private final SupervisorJdbcRepository supervisorRepository;
    private final AlcanceSupervisor alcanceSupervisor;

    private volatile List<CalificacionJdbcRepository.Fila> filas = List.of();
    private volatile long leidaEn = 0L;

    public CalificacionRiesgoService(CalificacionJdbcRepository calificacion,
                                     SupervisorJdbcRepository supervisorRepository,
                                     AlcanceSupervisor alcanceSupervisor) {
        this.calificacion = calificacion;
        this.supervisorRepository = supervisorRepository;
        this.alcanceSupervisor = alcanceSupervisor;
    }

    /**
     * La lista de calificación y riesgo recortada a lo que la persona puede ver.
     * El recorte es el mismo que el del listado de contratos: todas las secretarías, las que le
     * tocan o, si es un contratista, solo sus propios contratos.
     */
    public List<CalificacionRiesgoDTO> listar(AmbitoUsuario ambito) {
        List<CalificacionJdbcRepository.Fila> todas = filasVigentes();
        Set<String> permitidos;
        if ("SUPERVISOR".equals(ambito.rolCodigo()) && !ambito.verTodasSecretarias()) {
            permitidos = alcanceSupervisor.contratos(ambito.correo(), ambito.nombre());
        } else if ("BASICO".equals(ambito.rolCodigo()) && !ambito.verTodasSecretarias()) {
            permitidos = supervisorRepository.contratosPorCorreo(ambito.correo());
        } else {
            permitidos = null;
        }

        List<CalificacionRiesgoDTO> salida = new ArrayList<>();
        for (CalificacionJdbcRepository.Fila fila : todas) {
            if (permitidos != null) {
                if (!permitidos.contains(fila.noContrato())) {
                    continue;
                }
            } else if (!ambito.verTodasSecretarias()
                    && !ambito.secretarias().contains(AmbitoUsuario.normalizar(fila.dependencia()))) {
                continue;
            }
            salida.add(dto(fila));
        }
        return salida;
    }

    private static CalificacionRiesgoDTO dto(CalificacionJdbcRepository.Fila fila) {
        CalificacionRiesgoDTO dto = new CalificacionRiesgoDTO();
        dto.setNoContrato(fila.noContrato());
        dto.setContratista(fila.contratista());
        dto.setDependencia(fila.dependencia());
        dto.setFechaInicio(fila.fechaInicio());
        dto.setNivel(fila.nivel());
        dto.setPuntajeLabel(fila.puntajeLabel());
        dto.setRiesgo(fila.riesgo());
        dto.setExplicacion(fila.explicacion());
        return dto;
    }

    /** La lectura en cache, si sigue vigente; si no, se vuelve a leer del motor. */
    private List<CalificacionJdbcRepository.Fila> filasVigentes() {
        long ahora = System.currentTimeMillis();
        List<CalificacionJdbcRepository.Fila> actuales = filas;
        if (!actuales.isEmpty() && ahora - leidaEn < VALIDEZ.toMillis()) {
            return actuales;
        }
        synchronized (this) {
            if (!filas.isEmpty() && System.currentTimeMillis() - leidaEn < VALIDEZ.toMillis()) {
                return filas;
            }
            List<CalificacionJdbcRepository.Fila> leidas = calificacion.listarCalificacionYRiesgo();
            filas = List.copyOf(leidas);
            leidaEn = System.currentTimeMillis();
            return filas;
        }
    }
}
