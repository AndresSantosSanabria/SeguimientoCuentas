export const ESTADO_APROBADO = 19;
export const ESTADO_DEVOLUCION = 10;
export const ESTADOS_RECHAZO = new Set([3, 8]);
const ESTADO_COLORS = {
    0: '#94a3b8',
    1: '#38bdf8',
    2: '#f59e0b',
    3: '#f43f5e',
    4: '#14b8a6',
    5: '#0d9488',
    6: '#fbbf24',
    7: '#0ea5e9',
    8: '#e11d48',
    9: '#10b981',
    10: '#f97316',
    11: '#06b6d4',
    12: '#6366f1',
    13: '#8b5cf6',
    14: '#7c3aed',
    15: '#9333ea',
    16: '#a855f7',
    17: '#d946ef',
    18: '#db2777',
    19: '#059669',
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
    if (id >= 11)
        return 'info';
    return 'warning';
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
