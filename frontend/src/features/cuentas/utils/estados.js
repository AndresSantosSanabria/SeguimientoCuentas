export const ESTADO_APROBADO = 19;
export const ESTADO_DEVOLUCION = 10;
export const ESTADOS_RECHAZO = new Set([3, 8]);
const ESTADO_COLORS = {
    0: '#94a3b8',
    1: '#17699b',
    2: '#1b76ac',
    3: '#b3261e',
    4: '#2b8ab8',
    5: '#3e88b4',
    6: '#4f9dc0',
    7: '#5aa8cf',
    8: '#b3261e',
    9: '#1e7a46',
    10: '#a16207',
    11: '#0f4d72',
    12: '#3e6f9e',
    13: '#4a63a8',
    14: '#5b5fa8',
    15: '#6b62a0',
    16: '#7a6396',
    17: '#87608b',
    18: '#8f5f80',
    19: '#1e7a46',
};
export function estadoColor(id) {
    if (id === null || id === undefined)
        return ESTADO_COLORS[0];
    return ESTADO_COLORS[id] ?? '#64748b';
}
export function estadoTone(id) {
    if (id === null || id === undefined || id === 0)
        return 'neutral';
    if (id === ESTADO_APROBADO)
        return 'success';
    if (ESTADOS_RECHAZO.has(id))
        return 'danger';
    if (id === ESTADO_DEVOLUCION)
        return 'warning';
    if (id === 9)
        return 'success';
    return 'info';
}
export const ESTADO_LABELS = {
    0: 'Sin inicio',
    1: 'Registrando',
    2: 'En revisión',
    3: 'Rechazado',
    4: 'Aprobado pendiente firma',
    5: 'Aprobado pendiente firma y SECOP',
    6: 'Pendiente SECOP',
    7: 'En revisión SECOP',
    8: 'Rechazado SECOP',
    9: 'Aprobado',
    10: 'Informe devuelto',
    11: 'Supervisión registrada',
    12: 'RAS registrado',
    13: 'Enviado a enlace',
    14: 'Enviado a abogado',
    15: 'Enviado a usuario MM',
    16: 'Enviado a usuario FI',
    17: 'Enviado a ordenador',
    18: 'Enviado a tesorería',
    19: 'Informe aprobado',
};
export function estadoLabel(id, fallback) {
    if (id === null || id === undefined)
        return 'Sin estado';
    if (id === 0)
        return 'Sin inicio';
    if (fallback && fallback.trim())
        return fallback;
    return ESTADO_LABELS[id] ?? `Estado ${id}`;
}
/** Los grupos de sentido común que se usan para filtrar, sin listar los 19 estados. */
export const ESTADO_GRUPOS = [
    { valor: 'en-proceso', label: 'En proceso' },
    { valor: 'devuelta', label: 'En devolución' },
    { valor: 'rechazada', label: 'Rechazadas' },
    { valor: 'aprobada', label: 'Aprobadas' },
    { valor: 'sin-inicio', label: 'Sin iniciar' },
];
export function agruparEstado(id) {
    if (id === null || id === undefined || id === 0)
        return 'sin-inicio';
    if (id === ESTADO_APROBADO)
        return 'aprobada';
    if (ESTADOS_RECHAZO.has(id))
        return 'rechazada';
    if (id === ESTADO_DEVOLUCION)
        return 'devuelta';
    return 'en-proceso';
}
export function coincideGrupoEstado(id, grupo) {
    return !grupo || grupo === 'todos' || agruparEstado(id) === grupo;
}
