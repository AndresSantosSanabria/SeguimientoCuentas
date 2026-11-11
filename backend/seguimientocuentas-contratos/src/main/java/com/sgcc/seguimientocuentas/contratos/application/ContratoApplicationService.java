package com.sgcc.seguimientocuentas.contratos.application;

import com.sgcc.seguimientocuentas.accesos.domain.model.AmbitoUsuario;
import com.sgcc.seguimientocuentas.contratos.domain.model.FichaContrato;
import org.springframework.stereotype.Service;

@Service
public class ContratoApplicationService {

    public static final String PERMISO_VER_DETALLE = "CONTRATOS_VER_DETALLE";

    private final ContratoResumenIndex indice;

    public ContratoApplicationService(ContratoResumenIndex indice) {
        this.indice = indice;
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
                .append("  Supervisiones: ").append(dto.getTotalSupervisiones()).append(" de 12\n")
                .append("\n--- FLUJO PROCESO ---\n")
                .append("  Estado actual: ").append(dto.getEstadoActual()).append("\n");
        if (dto.getDescripcion() != null && !dto.getDescripcion().isBlank()) {
            texto.append("  Detalle: ").append(dto.getDescripcion()).append("\n");
        }
        if (dto.getFechaEstado() != null) texto.append("  Fecha: ").append(dto.getFechaEstado()).append("\n");
        if (dto.getSiguientePaso() != null) texto.append("  Siguiente paso: ").append(dto.getSiguientePaso()).append("\n");
        texto.append("\n--- ESTADO SUPERVISION ---\n")
                .append("  % Avance declarado: ").append(dto.getAvanceDeclarado()).append("%\n")
                .append("  Informe de actividades: ")
                .append(dto.getCuentasRegistradas() > 0 ? "CARGADO (" + dto.getCuentasRegistradas() + ")" : "PENDIENTE")
                .append("\n\n========================================\n");
        return texto.toString();
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
