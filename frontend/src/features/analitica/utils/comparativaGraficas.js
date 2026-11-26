import { dependenciaLabel } from '@/features/cuentas/utils/dependencias';
import { cuentasDelAlcance } from '@/features/cuentas/utils/alcanceCuentas';
import { ESTADO_APROBADO, agruparEstado } from '@/features/cuentas/utils/estados';
import {
    MESES,
    corteEfectivo,
    cuentasRadicadas,
    cuotasEnPeriodo,
    emparejarCuentas,
    fechaContratoValida,
    rangoFechas,
    solapaRango,
} from '@/features/cuentas/utils/cuentasSecretaria';
import { ETAPA_POR_BLOQUE, bloqueDeTramo, parseFechaPaso } from '@/features/analitica/utils/leadTime';
import { normalizar, startOfDay } from '@/shared/utils';

/**
 * Métricas por secretaría de las cuatro gráficas que acompañan a la comparativa.
 *
 * Todo se calcula sobre los contratos que ya carga la página (el espejo que el CDC
 * mantiene vivo por WebSocket), así que las gráficas se solas se actualizan cuando
 * llega un evento y respetan el mismo período y alcance de la barra superior.
 *
 * El universo de contratos y las cuentas exigibles son los mismos que usa la tarjeta
 * de la comparativa: vigencia dentro del período, cuotas ya vencidas al corte y la
 * regla de alcance (en curso / cerradas / ambas).
 */

const MS_POR_DIA = 86_400_000;
/** Con más meses que esto la línea se vuelve ilegible: se guardan los últimos. */
const LIMITE_MESES = 36;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Series de la gráfica de ejecución, en el orden en que se apilan. */
export const EJECUCION_SERIES = [
    { clave: 'completadas', pct: 'pctCompletadas', label: 'Completadas', color: '#1e7a46' },
    { clave: 'proceso', pct: 'pctProceso', label: 'En proceso', color: '#17699b' },
    { clave: 'devueltas', pct: 'pctDevoluciones', label: 'Devueltas', color: '#a16207' },
    { clave: 'mora', pct: 'pctMora', label: 'En mora (sin cuenta)', color: '#b3261e' },
];

/** Un color por secretaría elegida, en el orden de las tarjetas de la comparativa. */
export const COLORES_SECRETARIA = ['#17699b', '#b3261e', '#1e7a46', '#a16207', '#4a63a8', '#8f5f80'];

function preparar(contratos, secretarias) {
    const orden = (secretarias ?? []).map((nombre) => ({ nombre, clave: normalizar(nombre) }));
    const claves = new Set(orden.map((item) => item.clave));
    const seleccion = (contratos ?? []).filter((contrato) => claves.has(normalizar(dependenciaLabel(contrato))));
    return { orden, seleccion };
}

/**
 * El contrato entra en el alcance elegido, con la misma regla que la tarjeta:
 * en «cerradas» solo los que tienen alguna cuenta cerrada; en «en curso» los que
 * tienen alguna abierta, más los que todavía no radicaron ninguna cuenta.
 */
function entraAlcance(contrato, alcance) {
    if (alcance === 'ambas') return true;
    const todas = contrato.cuentasDetalle ?? [];
    const cerradas = alcance === 'cerradas';
    const hayDeAlcance = todas.some((cuenta) => (cuenta?.idEstadoActual === ESTADO_APROBADO) === cerradas);
    if (hayDeAlcance) return true;
    return !cerradas && todas.length === 0;
}

/** Cuotas ya vencidas al corte; `null` cuando el contrato no se puede medir. */
function calendarioDe(contrato, corte) {
    const inicio = fechaContratoValida(contrato.fechaInicio);
    const fin = fechaContratoValida(contrato.fechaFin);
    if (!inicio || !fin || fin.getTime() < inicio.getTime())
        return null;
    const calendario = cuotasEnPeriodo(inicio, fin, corte);
    return calendario.length > 0 ? calendario : null;
}

/** Cuota -> cuenta que la cubre, sobre el detalle completo del contrato. */
function cubiertasDe(contrato, calendario) {
    if (!contrato.cuentasDetalle?.length)
        return new Map();
    return emparejarCuentas(calendario, cuentasRadicadas(contrato)).porCuota;
}

/**
 * Sin detalle real vale el conteo declarado (las primeras cuentas del calendario),
 * igual que en la tarjeta: solo en «ambas», porque en curso no hay ninguna abierta.
 */
function declaradasDe(contrato, alcance, calendarioLength) {
    if (contrato.cuentasDetalle?.length || alcance !== 'ambas')
        return 0;
    return Math.min(Math.max(0, contrato.cuentasRegistradas ?? 0), calendarioLength);
}

/** Fechas de contrato y calendario de cuotas ya recortado al rango del período. */
function cuotasVisibles(contrato, corte, rango) {
    const calendario = calendarioDe(contrato, corte);
    if (!calendario)
        return null;
    const visibles = rango
        ? calendario.filter((cuota) => solapaRango(cuota.inicio, cuota.fin, rango))
        : calendario;
    return visibles.length > 0 ? { calendario, visibles } : null;
}

/**
 * Ejecución de cuentas: composición de las exigibles de cada secretaría en
 * completadas (cuenta aprobada), en proceso, devueltas y mora (cuota vencida
 * sin cuenta). Siempre suma las exigibles, así la barra apilada va al 100%.
 */
export function buildEjecucionSecretarias({ contratos = [], secretarias = [], alcance = 'curso', filtros = {}, hoy = new Date() }) {
    const inicioDia = startOfDay(hoy);
    const rango = rangoFechas(filtros, inicioDia);
    const corte = corteEfectivo(filtros, inicioDia);
    const { orden, seleccion } = preparar(contratos, secretarias);
    const porClave = new Map(orden.map((item) => [item.clave, {
        label: item.nombre,
        exigibles: 0,
        completadas: 0,
        proceso: 0,
        devueltas: 0,
        mora: 0,
    }]));

    for (const contrato of seleccion) {
        if (!entraAlcance(contrato, alcance))
            continue;
        const cuotas = cuotasVisibles(contrato, corte, rango);
        if (!cuotas)
            continue;
        const fila = porClave.get(normalizar(dependenciaLabel(contrato)));
        if (!fila)
            continue;
        const porCuota = cubiertasDe(contrato, cuotas.calendario);
        const declaradas = declaradasDe(contrato, alcance, cuotas.calendario.length);
        for (const cuota of cuotas.visibles) {
            fila.exigibles += 1;
            const cuenta = porCuota.get(cuota.indice);
            if (cuenta) {
                const grupo = agruparEstado(cuenta.idEstadoActual);
                if (grupo === 'aprobada')
                    fila.completadas += 1;
                else if (grupo === 'devuelta' || grupo === 'rechazada')
                    fila.devueltas += 1;
                else
                    fila.proceso += 1;
            }
            else if (cuota.indice < declaradas) {
                fila.completadas += 1;
            }
            else {
                fila.mora += 1;
            }
        }
    }

    const rows = orden.map((item) => {
        const fila = porClave.get(item.clave);
        const pct = (valor) => (fila.exigibles > 0 ? (valor * 100) / fila.exigibles : 0);
        return {
            ...fila,
            pctCompletadas: pct(fila.completadas),
            pctProceso: pct(fila.proceso),
            pctDevoluciones: pct(fila.devueltas),
            pctMora: pct(fila.mora),
        };
    });
    return {
        rows,
        exigibles: rows.reduce((suma, fila) => suma + fila.exigibles, 0),
    };
}

/** Mes de una fecha como número ordenable: anio * 12 + mes (0–11). */
function claveMes(fecha) {
    return fecha.getFullYear() * 12 + fecha.getMonth();
}

function anioYMes(clave) {
    return { anio: Math.floor(clave / 12), mes: (clave % 12) + 1 };
}

function etiquetaMesCorto(clave) {
    const { anio, mes } = anioYMes(clave);
    return `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`;
}

function etiquetaMesLargo(clave) {
    const { anio, mes } = anioYMes(clave);
    return `${MESES[mes - 1]} ${anio}`;
}

/** Fecha en que la cuenta empezó a moverse: el primer paso con fecha válida. */
function fechaRadicacion(cuenta) {
    const pasos = Array.isArray(cuenta?.pasos) ? cuenta.pasos : [];
    for (const paso of pasos) {
        const fecha = parseFechaPaso(paso?.fecha);
        if (fecha)
            return fecha;
    }
    return null;
}

/**
 * Tasa de mora mensual: porcentaje de cuentas exigibles que al cierre de cada
 * mes seguían sin cuenta radicada. La serie se acumula mes a mes y cada línea
 * es una secretaría elegida.
 */
export function buildMoraMensualSecretarias({ contratos = [], secretarias = [], alcance = 'curso', filtros = {}, hoy = new Date() }) {
    const inicioDia = startOfDay(hoy);
    const rango = rangoFechas(filtros, inicioDia);
    const corte = corteEfectivo(filtros, inicioDia);
    const { orden, seleccion } = preparar(contratos, secretarias);
    const porClave = new Map(orden.map((item, indice) => [item.clave, {
        clave: `s${indice}`,
        label: item.nombre,
        color: COLORES_SECRETARIA[indice % COLORES_SECRETARIA.length],
        exigibles: new Map(),
        radicadas: new Map(),
    }]));

    for (const contrato of seleccion) {
        if (!entraAlcance(contrato, alcance))
            continue;
        const cuotas = cuotasVisibles(contrato, corte, rango);
        if (!cuotas)
            continue;
        const acumulado = porClave.get(normalizar(dependenciaLabel(contrato)));
        if (!acumulado)
            continue;
        const porCuota = cubiertasDe(contrato, cuotas.calendario);
        for (const cuota of cuotas.visibles) {
            const mesVencimiento = claveMes(cuota.fin);
            acumulado.exigibles.set(mesVencimiento, (acumulado.exigibles.get(mesVencimiento) ?? 0) + 1);
            const cuenta = porCuota.get(cuota.indice);
            if (!cuenta)
                continue;
            // Una cuenta radicada antes de vencer la cuota cuenta desde el vencimiento:
            // hasta entonces la cuota todavía no era exigible.
            const radicacion = fechaRadicacion(cuenta) ?? cuota.fin;
            const mesRadicacion = Math.max(mesVencimiento, claveMes(radicacion));
            acumulado.radicadas.set(mesRadicacion, (acumulado.radicadas.get(mesRadicacion) ?? 0) + 1);
        }
    }

    const meses = [...new Set([...porClave.values()].flatMap((acumulado) => [...acumulado.exigibles.keys()]))]
        .sort((a, b) => a - b);
    const recortado = meses.length > LIMITE_MESES;
    const eje = recortado ? meses.slice(-LIMITE_MESES) : meses;
    const curso = new Map([...porClave.values()].map((acumulado) => [acumulado.clave, { exigidas: 0, radicadas: 0 }]));

    const puntos = eje.map((mes) => {
        const punto = { etiqueta: etiquetaMesCorto(mes), mesLargo: etiquetaMesLargo(mes), detalle: {} };
        for (const acumulado of porClave.values()) {
            const estado = curso.get(acumulado.clave);
            estado.exigidas += acumulado.exigibles.get(mes) ?? 0;
            estado.radicadas += acumulado.radicadas.get(mes) ?? 0;
            const mora = estado.exigidas > 0
                ? ((estado.exigidas - estado.radicadas) / estado.exigidas) * 100
                : null;
            punto[acumulado.clave] = mora === null ? null : Math.round(mora * 10) / 10;
            punto.detalle[acumulado.clave] = {
                exigibles: estado.exigidas,
                pendientes: Math.max(0, estado.exigidas - estado.radicadas),
            };
        }
        return punto;
    });

    return {
        series: [...porClave.values()].map(({ clave, label, color }) => ({ clave, label, color })),
        puntos,
        meses: eje.length,
        recortado,
    };
}

/**
 * Lead time por secretaría: los tramos de tiempo de cada cuenta se reparten por
 * etapa (igual que la gráfica de Lead Time) y se promedian por cuenta, que es lo
 * que permite comparar secretarías de tamaños distintos.
 */
export function buildLeadTimeSecretarias({ contratos = [], secretarias = [], alcance = 'curso', hoy = new Date() }) {
    const { orden, seleccion } = preparar(contratos, secretarias);
    const porClave = new Map(orden.map((item) => [item.clave, {
        label: item.nombre,
        aprobacion: 0,
        proceso: 0,
        cola: 0,
        entrega: 0,
        acumulado: 0,
        cuentas: 0,
    }]));
    const ahora = hoy.getTime();

    for (const contrato of seleccion) {
        const fila = porClave.get(normalizar(dependenciaLabel(contrato)));
        if (!fila)
            continue;
        for (const cuenta of cuentasDelAlcance(contrato, alcance)) {
            if (typeof cuenta?.idEstadoActual !== 'number')
                continue;
            const pasos = (Array.isArray(cuenta.pasos) ? cuenta.pasos : [])
                .filter((paso) => paso && typeof paso.idEstado === 'number');
            if (pasos.length === 0)
                continue;
            const acumulada = { aprobacion: 0, proceso: 0, cola: 0, entrega: 0, total: 0 };
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
                }
                else if (paso.idEstado === ESTADO_APROBADO) {
                    continue; // cerrada: el estado final ya no acumula más tiempo.
                }
                else {
                    hasta = new Date(ahora); // sigue aquí: es lo que lleva esperando.
                }
                const dias = (hasta.getTime() - desde.getTime()) / MS_POR_DIA;
                if (!(dias > 0))
                    continue;
                const bloque = bloqueDeTramo(paso.idEstado, i > 0 ? pasos[i - 1].idEstado : null);
                const etapa = bloque ? ETAPA_POR_BLOQUE[bloque] : null;
                if (!etapa)
                    continue;
                acumulada[etapa] += dias;
                acumulada.total += dias;
            }
            if (acumulada.total <= 0)
                continue;
            fila.aprobacion += acumulada.aprobacion;
            fila.proceso += acumulada.proceso;
            fila.cola += acumulada.cola;
            fila.entrega += acumulada.entrega;
            fila.acumulado += acumulada.total;
            fila.cuentas += 1;
        }
    }

    const rows = orden.map((item) => {
        const fila = porClave.get(item.clave);
        const cuentas = fila.cuentas || 1;
        return {
            label: fila.label,
            aprobacion: fila.aprobacion / cuentas,
            proceso: fila.proceso / cuentas,
            cola: fila.cola / cuentas,
            entrega: fila.entrega / cuentas,
            total: fila.acumulado / cuentas,
            muertos: (fila.aprobacion + fila.cola) / cuentas,
            valor: (fila.proceso + fila.entrega) / cuentas,
            cuentas: fila.cuentas,
            acumulado: fila.acumulado,
        };
    });
    return { rows, cuentas: rows.reduce((suma, fila) => suma + fila.cuentas, 0) };
}

function percentil(valores, p) {
    if (valores.length === 0)
        return 0;
    const indice = Math.min(valores.length - 1, Math.max(0, Math.ceil(p * valores.length) - 1));
    return valores[indice];
}

function unDecimal(valor) {
    return Math.round(valor * 10) / 10;
}

/**
 * Días de trámite de cada cuenta (del primer paso a su cierre, o hasta hoy si
 * sigue abierta) agrupados por secretaría: P50 es el flujo típico y P90 el de
 * los contratos trabados, que es lo que dispara el promedio.
 */
export function buildPercentilesTramite({ contratos = [], secretarias = [], alcance = 'curso', hoy = new Date() }) {
    const { orden, seleccion } = preparar(contratos, secretarias);
    const porClave = new Map(orden.map((item) => [item.clave, { label: item.nombre, dias: [] }]));
    const ahora = hoy.getTime();

    for (const contrato of seleccion) {
        const fila = porClave.get(normalizar(dependenciaLabel(contrato)));
        if (!fila)
            continue;
        for (const cuenta of cuentasDelAlcance(contrato, alcance)) {
            const pasos = Array.isArray(cuenta?.pasos) ? cuenta.pasos : [];
            const fechas = pasos.map((paso) => parseFechaPaso(paso?.fecha)).filter(Boolean);
            if (fechas.length === 0)
                continue;
            const ultima = pasos[pasos.length - 1];
            const hasta = ultima?.idEstado === ESTADO_APROBADO ? fechas[fechas.length - 1] : new Date(ahora);
            const dias = (hasta.getTime() - fechas[0].getTime()) / MS_POR_DIA;
            if (!(dias >= 0))
                continue;
            fila.dias.push(dias);
        }
    }

    const rows = orden.map((item) => {
        const fila = porClave.get(item.clave);
        const ordenados = [...fila.dias].sort((a, b) => a - b);
        return {
            label: fila.label,
            p50: unDecimal(percentil(ordenados, 0.5)),
            p90: unDecimal(percentil(ordenados, 0.9)),
            cuentas: ordenados.length,
        };
    });
    return { rows, cuentas: rows.reduce((suma, fila) => suma + fila.cuentas, 0) };
}
