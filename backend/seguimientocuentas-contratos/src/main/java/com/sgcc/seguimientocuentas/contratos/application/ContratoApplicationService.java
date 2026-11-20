package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.contratos.adapter.out.jpa.CalificacionJdbcRepository;
import com.sgcc.seguimientocuentas.contratos.domain.model.FichaContrato;
import org.springframework.stereotype.Service;

@Service
public class ContratoApplicationService {

    public static final String PERMISO_VER_DETALLE = "CONTRATOS_VER_DETALLE";

    private final ContratoResumenIndex indice;
    private final CalificacionJdbcRepository calificacion;

    public ContratoApplicationService(ContratoResumenIndex indice, CalificacionJdbcRepository calificacion) {
        this.indice = indice;
        this.calificacion = calificacion;
    }

    public String obtenerProgreso(String noContrato) {
        FichaContrato ficha = indice.buscar(noContrato);
        if (ficha == null) {
            return "Contrato no encontrado";
        }
        var dto = ficha.dto();
        StringBuilder texto = new StringBuilder("\n========================================\n")
                .append("CONTRATO: ").append(noContrato).append("\n========================================\n")
                .append("  Contratista: ").append(dto.getContratista()).append("\n")
                .append("\n--- SUPERVISION ---\n")
                .append("  Supervisiones registradas: ").append(dto.getTotalSupervisiones())
                .append(" de ").append(dto.getTotalSupervisionesEsperadas()).append(" (meses de vigencia)\n")
                .append("  % Avance declarado: ").append(dto.getAvanceDeclarado()).append("%\n")
                .append("  Informe de actividades: ")
                .append(dto.getCuentasRegistradas() > 0 ? "CARGADO (" + dto.getCuentasRegistradas() + ")" : "PENDIENTE")
                .append("\n")
                .append("\n--- FLUJO PROCESO ---\n")
                .append("  Estado actual: ").append(dto.getEstadoActual()).append("\n");
        if (dto.getDescripcion() != null && !dto.getDescripcion().isBlank()) {
            texto.append("  Detalle: ").append(dto.getDescripcion()).append("\n");
        }
        if (dto.getFechaEstado() != null) texto.append("  Fecha: ").append(dto.getFechaEstado()).append("\n");
        if (dto.getSiguientePaso() != null) texto.append("  Siguiente paso: ").append(dto.getSiguientePaso()).append("\n");
        texto.append(seccionCalificacion(noContrato));
        texto.append("\n========================================\n");
        return texto.toString();
    }

    /**
     * Calificación del servicio y riesgo de incumplimiento: dice en qué nivel califica el
     * contratista y si la última supervisión dejó algún riesgo abierto.
     */
    private String seccionCalificacion(String noContrato) {
        var cal = calificacion.ultimaCalificacion(noContrato);
        var riesgo = calificacion.ultimoRiesgo(noContrato);
        StringBuilder texto = new StringBuilder("\n--- CALIFICACION Y RIESGO ---\n");
        if (cal == null) {
            texto.append("  Calificación: Sin calificación registrada\n");
        } else {
            texto.append("  Calificación: ")
                    .append(cal.nivel() != null ? cal.nivel() : "—")
                    .append(cal.puntajeLabel() != null ? " · " + cal.puntajeLabel() : "")
                    .append("\n");
            if (cal.puntajeMin() != null && cal.puntajeMax() != null) {
                texto.append("  Rango del nivel: ").append(cal.puntajeMin()).append(" a ").append(cal.puntajeMax()).append("\n");
            }
            if (cal.descripcionNivel() != null && !cal.descripcionNivel().isBlank()) {
                texto.append("  Descripción del nivel: ").append(cal.descripcionNivel().trim()).append("\n");
            }
            if (cal.fecha() != null) {
                texto.append("  Fecha de calificación: ").append(fecha(cal.fecha())).append("\n");
            }
            if (cal.observaciones() != null && !cal.observaciones().isBlank()) {
                texto.append("  Observaciones: ").append(cal.observaciones().trim()).append("\n");
            }
        }
        if (riesgo == null) {
            texto.append("  Riesgo de incumplimiento: Sin supervisión registrada\n");
        } else {
            texto.append("  Riesgo de incumplimiento: ")
                    .append(riesgo.riesgo() != null && !riesgo.riesgo().isBlank() ? riesgo.riesgo() : "Sin definir")
                    .append("\n");
            if (riesgo.explicacion() != null && !riesgo.explicacion().isBlank()) {
                texto.append("  Explicación del riesgo: ").append(riesgo.explicacion().trim()).append("\n");
            }
            if (riesgo.incumplimientos() != null && !riesgo.incumplimientos().isBlank()) {
                texto.append("  Incumplimientos o accidentes: ").append(riesgo.incumplimientos().trim()).append("\n");
            }
            if (riesgo.fecha() != null) {
                texto.append("  Fecha de la supervisión: ").append(fecha(riesgo.fecha())).append("\n");
            }
        }
        return texto.toString();
    }

    /** La fecha del motor llega como marca de tiempo: solo interesan el día y la hora. */
    private static String fecha(String valor) {
        String texto = valor.trim();
        return texto.length() > 16 ? texto.substring(0, 16) : texto;
    }

    /**
     * Si la persona puede ver el detalle de ese contrato: el permiso de ver el detalle y que el
     * contrato sea de una secretaria que le corresponda.
     */
    public boolean puedeVer(String noContrato, AmbitoUsuario ambito) {
        if (!ambito.puede(PERMISO_VER_DETALLE)) {
            return false;
        }
        if ("ADMIN".equals(ambito.rolCodigo()) || ambito.verTodasSecretarias()) {
            return true;
        }
        FichaContrato ficha = indice.buscar(noContrato);
        if (ficha == null) {
            return false;
        }
        return ambito.veContrato(ficha.dto().getContratista(), ficha.dto().getDependencia());
    }
}
