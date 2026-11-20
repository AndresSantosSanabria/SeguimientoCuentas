import { getJson, getText } from '@/shared/services';
export function fetchContratos() {
    return getJson('/api/contratos');
}
export function fetchReporteContrato(noContrato) {
    return getText(`/api/contratos/${encodeURIComponent(noContrato)}`);
}

export function fetchValorContrato(noContrato) {
    return getJson(`/api/contratos/${encodeURIComponent(noContrato)}/valor`);
}

export function fetchAdicionContrato(noContrato) {
    return getJson(`/api/contratos/${encodeURIComponent(noContrato)}/adicion`);
}

export function fetchCalificacionRiesgo() {
    return getJson('/api/contratos/calificacion-riesgo');
}
export function fetchContratosSupervisados() {
    return getJson('/api/contratos/supervisados');
}
