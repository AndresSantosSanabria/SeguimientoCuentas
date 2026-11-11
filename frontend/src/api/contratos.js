import { getJson, getText } from '@/api/client';
export function fetchContratos() {
    return getJson('/api/contratos');
}
export function fetchReporteContrato(noContrato) {
    return getText(`/api/contratos/${encodeURIComponent(noContrato)}`);
}

export function fetchValorContrato(noContrato) {
    return getJson(`/api/contratos/${encodeURIComponent(noContrato)}/valor`);
}

export function fetchContratosSupervisados() {
    return getJson('/api/contratos/supervisados');
}
