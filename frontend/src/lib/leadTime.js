import { BLOQUES, BLOQUE_POR_ESTADO, ESTADOS_DEVOLUCION, bloqueDevolucion, etiquetaCuenta } from '@/lib/bloques';
import { ESTADO_APROBADO, estadoLabel } from '@/lib/estados';
import { formatNumber, parseDateOnly } from '@/lib/format';

/**
 * Desglose del Lead Time por Proceso (bloque) y Etapa.
 *
 * Cada cuenta trae sus pasos con fecha: el intervalo entre dos fechas seguidas
 * se atribuye al estado vigente en ese tramo, ese estado cae en un bloque (#1…#8)
 * y el bloque define la etapa en que se acumula el tiempo:
 *  - tiempos con valor: Procesamiento (#1 Contratista) y Entrega (#6 Ordenador, #8 Tesorería);
 *  - tiempos muertos: Recepción y Aprobación (#2 Supervisor) y Espera / Cola (#3 Enlace,
 *    #4 Área Jurídica, #5 Usuario MM, #7 Usuario FI).
 * Una cuenta que sigue en curso sigue acumulando en su estado actual (hasta «hoy»),
 * que es justo donde se ve el cuello de botella; una cerrada (19) ya no acumula.
 */
export const ETAPAS = [
    { id: 'aprobacion', label: 'Recepción y Aprobación', tipo: 'muerto', color: '#f59e0b' },
    { id: 'proceso', label: 'Procesamiento', tipo: 'valor', color: '#0d9488' },
    { id: 'cola', label: 'Espera / Cola', tipo: 'muerto', color: '#94a3b8' },
    { id: 'entrega', label: 'Entrega', tipo: 'valor', color: '#6366f1' },
];

/** Bloque -> etapa en la que se acumula el tiempo que pasa la cuenta en ese bloque. */
export const ETAPA_POR_BLOQUE = {
    contratista: 'proceso',
    supervisor: 'aprobacion',
    enlace: 'cola',
    juridica: 'cola',
    mm: 'cola',
    fi: 'cola',
    ordenador: 'entrega',
    tesoreria: 'entrega',
};

/** Alcance del filtro de la tarjeta: en curso es el valor por defecto. */
export const ALCANCES_LEADTIME = [
    { valor: 'curso', label: 'En curso' },
    { valor: 'cerradas', label: 'Cerradas' },
    { valor: 'ambas', label: 'Ambas' },
];

/** Fecha de un paso: el backend manda `LocalDateTime` («2025-01-15T10:30:00») o fecha simple. */
function parseFechaPaso(value) {
    if (!value)
        return null;
    const texto = String(value).trim();
    if (!texto)
        return null;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? parseDateOnly(texto) : new Date(texto);
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

/** Bloque que tiene la cuenta durante ese tramo: el del estado, o el que la retoma si es devolución. */
function bloqueDeTramo(idEstado, origen) {
    if (idEstado === ESTADO_APROBADO)
        return 'tesoreria';
    if (ESTADOS_DEVOLUCION.has(idEstado))
        return bloqueDevolucion(origen);
    return BLOQUE_POR_ESTADO[idEstado] ?? null;
}

/** Etiqueta «#1 Contratista» de cada bloque, igual que en las filas del gráfico. */
const ETIQUETA_BLOQUE = new Map(BLOQUES.map((bloque) => [bloque.id, `#${bloque.numero} ${bloque.nombre}`]));

/** Duración legible: minutos u horas cuando el lapso es corto, días cuando crece. */
export function formatDuracion(dias) {
    if (!Number.isFinite(dias) || dias <= 0)
        return '0 h';
    if (dias < 1) {
        const horas = dias * 24;
        if (horas < 1)
            return `${Math.max(1, Math.round(horas * 60))} min`;
        return `${String(Math.round(horas * 10) / 10).replace('.', ',')} h`;
    }
    return `${formatNumber(Math.round(dias * 100) / 100)} días`;
}

function redondear(dias) {
    return Math.round(dias * 10_000) / 10_000;
}

/**
 * Agrega el lead time de todas las cuentas de los contratos en bloques y etapas.
 * `alcance` decide qué cuentas entran: 'curso' (por defecto), 'cerradas' o 'ambas'.
 * Devuelve las filas del gráfico (las que tienen tiempo) y el detalle tramo a tramo
 * que alimenta la hoja «Datos» del Excel.
 */
export function buildLeadTime(contratos, alcance = 'curso', hoy = new Date()) {
    const ahora = hoy.getTime();
    const filas = new Map(BLOQUES.map((bloque) => [bloque.id, {
        numero: bloque.numero,
        id: bloque.id,
        label: ETIQUETA_BLOQUE.get(bloque.id),
        nombre: bloque.nombre,
        aprobacion: 0,
        proceso: 0,
        cola: 0,
        entrega: 0,
        total: 0,
        cuentas: 0,
    }]));
    const detalle = [];
    let cuentas = 0;

    for (const contrato of contratos ?? []) {
        for (const cuenta of contrato?.cuentasDetalle ?? []) {
            const idActual = cuenta?.idEstadoActual;
            if (typeof idActual !== 'number')
                continue;
            if (alcance === 'curso' && idActual === ESTADO_APROBADO)
                continue;
            if (alcance === 'cerradas' && idActual !== ESTADO_APROBADO)
                continue;
            const pasos = (Array.isArray(cuenta.pasos) ? cuenta.pasos : [])
                .filter((paso) => paso && typeof paso.idEstado === 'number');
            if (pasos.length === 0)
                continue;

            const porBloque = new Map();
            for (let i = 0; i < pasos.length; i += 1) {
                const paso = pasos[i];
                const desde = parseFechaPaso(paso.fecha);
                if (!desde)
                    continue;
                const siguiente = pasos[i + 1];
                let hasta;
                if (siguiente) {
                    hasta = parseFechaPaso(siguiente.fecha);
                    if (!hasta)
                        continue;
                } else if (paso.idEstado === ESTADO_APROBADO) {
                    continue; // cerrada: el estado final ya no acumula más tiempo.
                } else {
                    hasta = new Date(ahora); // sigue aquí: este es el tiempo que lleva esperando.
                }
                const dias = (hasta.getTime() - desde.getTime()) / 86_400_000;
                if (!(dias > 0))
                    continue;
                const bloque = bloqueDeTramo(paso.idEstado, i > 0 ? pasos[i - 1].idEstado : null);
                if (!bloque)
                    continue;
                porBloque.set(bloque, (porBloque.get(bloque) ?? 0) + dias);
                detalle.push({
                    bloque,
                    proceso: ETIQUETA_BLOQUE.get(bloque) ?? bloque,
                    cuenta: etiquetaCuenta(cuenta),
                    contrato: contrato?.noContrato ?? '—',
                    estado: estadoLabel(paso.idEstado, paso.estado),
                    etapa: ETAPA_POR_BLOQUE[bloque],
                    desde: paso.fecha ?? null,
                    hasta: siguiente ? (siguiente.fecha ?? null) : null,
                    dias: redondear(dias),
                });
            }
            if (porBloque.size === 0)
                continue;
            cuentas += 1;
            for (const [bloque, dias] of porBloque) {
                const fila = filas.get(bloque);
                if (!fila)
                    continue;
                fila[ETAPA_POR_BLOQUE[bloque]] += dias;
                fila.total += dias;
                fila.cuentas += 1;
            }
        }
    }

    const rows = [...filas.values()]
        .filter((fila) => fila.total > 0)
        .sort((a, b) => a.numero - b.numero);

    const totales = { aprobacion: 0, proceso: 0, cola: 0, entrega: 0, total: 0, cuentas: 0 };
    for (const fila of rows) {
        for (const etapa of ETAPAS)
            totales[etapa.id] += fila[etapa.id];
        totales.total += fila.total;
        totales.cuentas += fila.cuentas;
    }
    totales.muertos = totales.aprobacion + totales.cola;
    totales.valor = totales.proceso + totales.entrega;

    return { rows, detalle, cuentas, totales };
}
