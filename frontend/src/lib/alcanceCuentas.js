import { ESTADO_APROBADO } from '@/lib/estados';

/**
 * Alcance de cuentas de la página: define qué cuentas se miden en toda la analítica.
 *  - «En curso» (por defecto): las cuentas que siguen abiertas;
 *  - «Cerradas»: solo las cuentas ya cerradas (estado 19);
 *  - «Ambas»: los dos universos unidos.
 */
export const ALCANCES_CUENTAS = [
    { valor: 'curso', label: 'En curso' },
    { valor: 'cerradas', label: 'Cerradas' },
    { valor: 'ambas', label: 'Ambas' },
];

export function cuentaCerrada(cuenta) {
    return cuenta?.idEstadoActual === ESTADO_APROBADO;
}

/** Cuentas del contrato que entran en el alcance elegido. */
export function cuentasDelAlcance(contrato, alcance) {
    const cuentas = contrato?.cuentasDetalle ?? [];
    if (alcance === 'ambas') return cuentas;
    return cuentas.filter((cuenta) => (alcance === 'cerradas') === cuentaCerrada(cuenta));
}

/**
 * Contrato recortado al alcance: solo quedan sus cuentas del alcance y los contadores
 * de cuentas se recalculan sobre ellas. El estado del contrato pasa a ser el de la
 * cuenta del alcance que está en curso, para que los estados que se muestran en las
 * gráficas sean los de ese universo.
 */
export function contratoEnAlcance(contrato, alcance) {
    if (alcance === 'ambas') return contrato;
    const todas = contrato?.cuentasDetalle ?? [];
    const cuentas = cuentasDelAlcance(contrato, alcance);
    if (cuentas.length === 0) {
        // Sin cuentas del alcance: en «cerradas» no hay nada cerrado que contar; en
        // «en curso» solo sobreviven los contratos que aún no radicaron ninguna cuenta.
        if (alcance === 'cerradas' || todas.length > 0) return null;
        return contrato;
    }
    const vigente = cuentas.find((cuenta) => cuenta.activa) ?? cuentas[cuentas.length - 1];
    return {
        ...contrato,
        cuentasDetalle: cuentas,
        cuentasRegistradas: cuentas.length,
        informeCargado: true,
        idEstadoActual: vigente?.idEstadoActual ?? contrato.idEstadoActual,
        estadoActual: vigente?.estadoActual ?? contrato.estadoActual,
    };
}

/** Contratos que dejan la página según el alcance de cuentas. */
export function contratosEnAlcance(contratos, alcance) {
    return (contratos ?? [])
        .map((contrato) => contratoEnAlcance(contrato, alcance))
        .filter(Boolean);
}
