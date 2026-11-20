import { diffInDays, parseDateOnly } from '@/shared/utils';
export const ALERTA_OPTIONS = [
    { value: 'all', label: 'Todas las alertas' },
    { value: 'rechazados', label: 'Informes rechazados' },
    { value: 'devueltos', label: 'Informes devueltos' },
    { value: 'mora', label: 'Cuentas de cobro en mora' },
    { value: 'por-vencer', label: 'Vencen en 30 días' },
];
export const AVANCE_OPTIONS = [
    { value: 'all', label: 'Cualquier avance' },
    { value: '0-25', label: '0 – 25%' },
    { value: '26-50', label: '26 – 50%' },
    { value: '51-75', label: '51 – 75%' },
    { value: '76-99', label: '76 – 99%' },
    { value: '100', label: '100%' },
];
export const SUPERVISION_OPTIONS = [
    { value: 'all', label: 'Todas' },
    { value: 'con', label: 'Con supervisión' },
    { value: 'sin', label: 'Sin supervisión' },
];
export const INFORME_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'cargado', label: 'Cargados' },
    { value: 'pendiente', label: 'Pendientes' },
];
export function isAlertaFiltro(value) {
    return ALERTA_OPTIONS.some((option) => option.value === value);
}
export function isAvanceFiltro(value) {
    return AVANCE_OPTIONS.some((option) => option.value === value);
}
export function isSupervisionFiltro(value) {
    return SUPERVISION_OPTIONS.some((option) => option.value === value);
}
export function isInformeFiltro(value) {
    return INFORME_OPTIONS.some((option) => option.value === value);
}
/** Con o sin algún registro de supervisión: es el corte que usan los KPIs de cobertura. */
export function matchesSupervision(contrato, supervision) {
    const registros = contrato.totalSupervisiones ?? 0;
    if (supervision === 'con') return registros > 0;
    if (supervision === 'sin') return registros === 0;
    return true;
}
/** Informe de actividades cargado o no: la mitad "cargados" son los que ya radicaron. */
export function matchesInforme(contrato, informe) {
    if (informe === 'cargado') return contrato.informeCargado === true;
    if (informe === 'pendiente') return contrato.informeCargado !== true;
    return true;
}
export function matchesAlerta(contrato, alerta) {
    const estado = contrato.idEstadoActual;
    switch (alerta) {
        case 'rechazados':
            return estado === 3 || estado === 8;
        case 'devueltos':
            return estado === 10;
        case 'mora':
            return contrato.cuentasEnMora > 0;
        case 'por-vencer': {
            const fin = parseDateOnly(contrato.fechaFin);
            if (!fin)
                return false;
            const dias = diffInDays(new Date(), fin);
            return dias >= 0 && dias <= 30;
        }
        default:
            return true;
    }
}
export function matchesAvance(contrato, avance) {
    const value = contrato.porcentajeAvance ?? 0;
    switch (avance) {
        case '0-25':
            return value <= 25;
        case '26-50':
            return value > 25 && value <= 50;
        case '51-75':
            return value > 50 && value <= 75;
        case '76-99':
            return value > 75 && value < 100;
        case '100':
            return value >= 100;
        default:
            return true;
    }
}
export const ORDEN_OPTIONS = [
    { value: 'avance-desc', label: 'Mayor avance' },
    { value: 'avance-asc', label: 'Menor avance' },
    { value: 'supervisiones-desc', label: 'Más supervisiones' },
    { value: 'fecha-desc', label: 'Fecha fin más reciente' },
    { value: 'fecha-asc', label: 'Fecha fin más antigua' },
    { value: 'contrato-asc', label: 'No. contrato' },
    { value: 'contratista-asc', label: 'Contratista' },
];
export function isOrdenFiltro(value) {
    return ORDEN_OPTIONS.some((option) => option.value === value);
}
function time(value) {
    const date = parseDateOnly(value);
    return date ? date.getTime() : 0;
}
export function compareContratos(a, b, orden) {
    switch (orden) {
        case 'avance-desc':
            return (b.porcentajeAvance ?? 0) - (a.porcentajeAvance ?? 0);
        case 'avance-asc':
            return (a.porcentajeAvance ?? 0) - (b.porcentajeAvance ?? 0);
        case 'supervisiones-desc':
            return (b.totalSupervisiones ?? 0) - (a.totalSupervisiones ?? 0);
        case 'fecha-asc':
            return time(a.fechaFin) - time(b.fechaFin);
        case 'contrato-asc':
            return (a.noContrato ?? '').localeCompare(b.noContrato ?? '', 'es');
        case 'contratista-asc':
            return (a.contratista ?? '').localeCompare(b.contratista ?? '', 'es');
        case 'fecha-desc':
        default:
            return time(b.fechaFin) - time(a.fechaFin);
    }
}
