import { getJson, getText } from '@/api/client';
export function fetchContratos() {
    return getJson('/api/contratos');
}
export function fetchReporteContrato(noContrato) {
    return getText(`/api/contratos/${encodeURIComponent(noContrato)}`);
}
