import { ESTADO_APROBADO, ESTADO_DEVOLUCION, ESTADOS_RECHAZO } from '@/lib/estados';

/**
 * Avance de una cuenta de cobro sobre el recorrido estándar del BPMN.
 *
 * El porcentaje responde «¿en qué etapa va la cuenta y cuánto le falta?»: cada hito
 * es una parada del camino feliz, en el orden en que la cuenta debería recorrerlo.
 * Se alcanza cuando uno de sus estados aparece en el historial de pasos:
 *  - el hito de SECOP II es opcional y solo aplica a las cuentas que lo requieren;
 *  - una devolución no borra lo ya avanzado: el % marca hasta dónde llegó;
 *  - una cuenta cerrada (estado 19) siempre muestra 100 %.
 */
export const HITOS = [
    { id: 'registro', etiqueta: 'Registro del informe', estados: [1] },
    { id: 'revision', etiqueta: 'Revisión del supervisor', estados: [2] },
    { id: 'aprobacion', etiqueta: 'Aprobación y firma', estados: [4, 5] },
    { id: 'secop', etiqueta: 'Cargue en SECOP II', estados: [6, 7], soloSecop: true },
    { id: 'informe', etiqueta: 'Informe de supervisión y RAS', estados: [9, 11, 12] },
    { id: 'enlace', etiqueta: 'Control documental · Enlace', estados: [13] },
    { id: 'juridica', etiqueta: 'Visto bueno · Área Jurídica', estados: [14] },
    { id: 'mm', etiqueta: 'Gestión de materiales · MM', estados: [15] },
    { id: 'fi', etiqueta: 'Revisión de finanzas · FI', estados: [16] },
    { id: 'ordenador', etiqueta: 'Firma del documento · Ordenador', estados: [17] },
    { id: 'tesoreria', etiqueta: 'Recepción y pago · Tesorería', estados: [18] },
    { id: 'cierre', etiqueta: 'Pago y cierre en SECOP II', estados: [19] },
];

/**
 * Avance de la cuenta: porcentaje, etapa en la que está y cuántas lleva de cuántas.
 * @param {object} cuenta cuenta de cobro (puede venir sin pasos)
 * @param {Array<{idEstado: number}>} pasos historial de estados de la cuenta
 */
export function avanceDeCuenta(cuenta, pasos = []) {
    const estados = new Set(
        (Array.isArray(pasos) ? pasos : [])
            .map((paso) => paso?.idEstado)
            .filter((id) => typeof id === 'number'),
    );
    if (typeof cuenta?.idEstadoActual === 'number')
        estados.add(cuenta.idEstadoActual);

    const aplicables = HITOS.filter((hito) => !hito.soloSecop || Boolean(cuenta?.requiereSecop));
    const total = aplicables.length;
    let ultimo = -1;
    aplicables.forEach((hito, indice) => {
        if (hito.estados.some((id) => estados.has(id)))
            ultimo = indice;
    });

    const cerrado = estados.has(ESTADO_APROBADO);
    const actual = cuenta?.idEstadoActual;
    const devuelta =
        actual === ESTADO_DEVOLUCION || ESTADOS_RECHAZO.has(actual);
    const etapas = Math.max(0, ultimo + 1);
    const pct = cerrado ? 100 : total > 0 ? Math.round((etapas / total) * 100) : 0;

    let hitoActual = 'Sin iniciar';
    if (cerrado) hitoActual = 'Proceso completado';
    else if (devuelta) hitoActual = `${aplicables[ultimo]?.etiqueta ?? 'Etapa actual'} · en devolución`;
    else if (ultimo >= 0) hitoActual = aplicables[ultimo].etiqueta;

    return { pct, hitoActual, etapas, total, cerrado, devuelta };
}
