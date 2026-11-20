/**
 * Calificación y riesgo de los contratistas.
 *
 * La calificación dice en qué nivel califica el contratista (A Notable, B Confiable, C Riesgo,
 * D Crítico) y el riesgo es el de incumplimiento que dejó la última supervisión (Alto, Medio,
 * Bajo, Ninguno). Aquí se resumen los dos y se ordenan los contratos por lo grave que se ve.
 */

/** Los niveles de la escala de calificación, del mejor al peor. */
export const NIVELES_CALIFICACION = [
    { nivel: 'A', label: 'Notable', tone: 'success', peso: 1 },
    { nivel: 'B', label: 'Confiable', tone: 'info', peso: 2 },
    { nivel: 'C', label: 'Riesgo', tone: 'warning', peso: 3 },
    { nivel: 'D', label: 'Crítico', tone: 'danger', peso: 4 },
];

/** Los riesgos de incumplimiento que registra una supervisión, del más grave al menos. */
export const NIVELES_RIESGO = [
    { valor: 'Alto', tone: 'danger', peso: 4 },
    { valor: 'Medio', tone: 'warning', peso: 3 },
    { valor: 'Bajo', tone: 'info', peso: 2 },
    { valor: 'Ninguno', tone: 'success', peso: 1 },
];

const pesoNivel = (nivel) => NIVELES_CALIFICACION.find((item) => item.nivel === nivel)?.peso ?? 0;
const pesoRiesgo = (riesgo) => NIVELES_RIESGO.find((item) => item.valor === riesgo)?.peso ?? 0;

/**
 * Resume la calificación y el riesgo de los contratos del universo medido.
 *
 * @param {Array} filas calificación y riesgo tal como los entrega el backend.
 * @param {Set<string>} universo contratos que la página está midiendo (filtros de años y alcance).
 */
export function buildCalificacionRiesgo(filas, universo) {
    const datos = (filas ?? []).filter((fila) => !universo || universo.has(fila.noContrato));

    const porNivel = new Map();
    const porRiesgo = new Map();
    for (const fila of datos) {
        const nivel = fila.nivel?.trim() || null;
        const riesgo = fila.riesgo?.trim() || null;
        if (nivel) porNivel.set(nivel, (porNivel.get(nivel) ?? 0) + 1);
        if (riesgo) porRiesgo.set(riesgo, (porRiesgo.get(riesgo) ?? 0) + 1);
    }

    const totalNivel = [...porNivel.values()].reduce((suma, valor) => suma + valor, 0);
    const totalRiesgo = [...porRiesgo.values()].reduce((suma, valor) => suma + valor, 0);

    const resumenNiveles = NIVELES_CALIFICACION.map((item) => ({
        ...item,
        total: porNivel.get(item.nivel) ?? 0,
    })).filter((item) => item.total > 0);

    const resumenRiesgos = NIVELES_RIESGO.map((item) => ({
        ...item,
        total: porRiesgo.get(item.valor) ?? 0,
    })).filter((item) => item.total > 0);

    const detalle = datos
        .filter((fila) => fila.nivel || fila.riesgo)
        .sort((a, b) => (pesoRiesgo(b.riesgo) - pesoRiesgo(a.riesgo))
            || (pesoNivel(b.nivel) - pesoNivel(a.nivel))
            || String(a.noContrato).localeCompare(String(b.noContrato)));

    return {
        resumenNiveles,
        resumenRiesgos,
        totalNivel,
        totalRiesgo,
        detalle,
    };
}
