import { dependenciaLabel } from '@/lib/dependencias';
import { parseDateOnly, startOfDay } from '@/lib/format';
export const MESES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];
const TOP_SECRETARIAS = 8;
export function aniosDisponibles(contratos) {
    const anios = new Set();
    for (const contrato of contratos) {
        const inicio = parseDateOnly(contrato.fechaInicio);
        if (!inicio)
            continue;
        const anio = inicio.getFullYear();
        if (anio >= 1900 && anio <= 2100)
            anios.add(anio);
    }
    return [...anios].sort((a, b) => b - a);
}
export function secretariasDisponibles(contratos) {
    const labels = new Set();
    for (const contrato of contratos) {
        labels.add(dependenciaLabel(contrato));
    }
    return [...labels].sort((a, b) => a.localeCompare(b, 'es'));
}
export function cortePeriodo(anio, mes, hoy = startOfDay(new Date()), mesHasta = null) {
    const { hasta } = rangoMeses(mes, mesHasta);
    const finPeriodo = new Date(anio, hasta, 0);
    return hoy.getTime() < finPeriodo.getTime() ? hoy : finPeriodo;
}
/**
 * Normaliza «Mes» + «Hasta» a un rango [desde, hasta] (1–12).
 * Sin «Hasta» conserva el comportamiento anterior: un solo mes o el año completo.
 * Si el usuario elige un «Hasta» anterior al «Mes», el rango se intercambia.
 */
export function rangoMeses(mes, mesHasta = null) {
    const sinHasta = mesHasta === null || mesHasta === undefined || mesHasta === '' || mesHasta === 'todos';
    let desde = mes === 'todos' ? 1 : Number(mes);
    let hasta = sinHasta ? (mes === 'todos' ? 12 : desde) : Number(mesHasta);
    if (!Number.isFinite(desde)) desde = 1;
    if (!Number.isFinite(hasta)) hasta = 12;
    if (hasta < desde) {
        const temporal = desde;
        desde = hasta;
        hasta = temporal;
    }
    return { desde, hasta };
}
export function periodoLabel(anio, mes, mesHasta = null) {
    const sinHasta = mesHasta === null || mesHasta === undefined || mesHasta === '' || mesHasta === 'todos';
    if (mes === 'todos' && sinHasta)
        return `Año ${anio}`;
    const { desde, hasta } = rangoMeses(mes, mesHasta);
    if (desde === hasta)
        return `${MESES[desde - 1]} ${anio}`;
    return `${MESES[desde - 1]} – ${MESES[hasta - 1]} ${anio}`;
}
function parseFechaContrato(value) {
    const fecha = parseDateOnly(value);
    if (!fecha)
        return null;
    const anio = fecha.getFullYear();
    return anio >= 1900 && anio <= 2100 ? fecha : null;
}
function cuentasExigiblesAlCorte(inicio, fin, corte) {
    if (!fin)
        return 0;
    if (fin.getTime() < inicio.getTime())
        return 0;
    if (corte.getTime() < inicio.getTime())
        return 0;
    const esperadas = mesesEsperados(inicio, fin);
    let exigibles = 0;
    for (let k = 0; k < esperadas; k++) {
        const cierre = plusMonths(inicio, k + 1);
        cierre.setDate(cierre.getDate() - 1);
        const limite = cierre.getTime() > fin.getTime() ? fin : cierre;
        if (limite.getTime() > corte.getTime())
            break;
        exigibles += 1;
    }
    return exigibles;
}
export function plusMonths(date, months) {
    const total = date.getMonth() + months;
    const anio = date.getFullYear() + Math.floor(total / 12);
    const mes = ((total % 12) + 12) % 12;
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return new Date(anio, mes, Math.min(date.getDate(), ultimoDia));
}
export function mesesEsperados(inicio, fin) {
    let anios = fin.getFullYear() - inicio.getFullYear();
    let meses = fin.getMonth() - inicio.getMonth();
    let dias = fin.getDate() - inicio.getDate();
    if (dias < 0) {
        const diasMesAnterior = new Date(fin.getFullYear(), fin.getMonth(), 0).getDate();
        dias += diasMesAnterior;
        meses -= 1;
    }
    if (meses < 0) {
        anios -= 1;
        meses += 12;
    }
    const total = anios * 12 + meses + (dias > 0 ? 1 : 0);
    return Math.max(1, total);
}
export function buildCuentasSecretaria(contratos, filtros, hoy = new Date()) {
    const corte = cortePeriodo(filtros.anio, filtros.mes, startOfDay(hoy), filtros.mesHasta ?? null);
    const mapa = new Map();
    let totalCompletadas = 0;
    let totalPendientes = 0;
    let totalExigibles = 0;
    let contratosConDeuda = 0;
    let contratosEnPeriodo = 0;
    for (const contrato of contratos) {
        const label = dependenciaLabel(contrato);
        if (filtros.secretaria && label !== filtros.secretaria)
            continue;
        const inicio = parseFechaContrato(contrato.fechaInicio);
        const fin = parseFechaContrato(contrato.fechaFin);
        if (!inicio || !fin || fin.getTime() < inicio.getTime())
            continue;
        const exigibles = cuentasExigiblesAlCorte(inicio, fin, corte);
        if (exigibles <= 0)
            continue;
        const registradas = Math.max(0, contrato.cuentasRegistradas ?? 0);
        const completadas = Math.min(registradas, exigibles);
        const pendientes = exigibles - completadas;
        const row = mapa.get(label) ?? {
            label,
            completadas: 0,
            pendientes: 0,
            exigibles: 0,
            contratos: 0,
            contratosConDeuda: 0,
        };
        row.completadas += completadas;
        row.pendientes += pendientes;
        row.exigibles += exigibles;
        row.contratos += 1;
        if (pendientes > 0)
            row.contratosConDeuda += 1;
        mapa.set(label, row);
        totalCompletadas += completadas;
        totalPendientes += pendientes;
        totalExigibles += exigibles;
        contratosEnPeriodo += 1;
        if (pendientes > 0)
            contratosConDeuda += 1;
    }
    const ordenadas = [...mapa.values()]
        .filter((row) => !filtros.soloDeuda || row.pendientes > 0)
        .sort((a, b) => b.pendientes - a.pendientes ||
        b.completadas - a.completadas ||
        a.label.localeCompare(b.label, 'es'));
    let rows = ordenadas;
    if (!filtros.secretaria && ordenadas.length > TOP_SECRETARIAS) {
        const top = ordenadas.slice(0, TOP_SECRETARIAS);
        const resto = ordenadas.slice(TOP_SECRETARIAS);
        top.push({
            label: `Otras (${resto.length} secretarías)`,
            completadas: resto.reduce((sum, row) => sum + row.completadas, 0),
            pendientes: resto.reduce((sum, row) => sum + row.pendientes, 0),
            exigibles: resto.reduce((sum, row) => sum + row.exigibles, 0),
            contratos: resto.reduce((sum, row) => sum + row.contratos, 0),
            contratosConDeuda: resto.reduce((sum, row) => sum + row.contratosConDeuda, 0),
        });
        rows = top;
    }
    return {
        rows,
        totalCompletadas,
        totalPendientes,
        totalExigibles,
        contratosConDeuda,
        contratosEnPeriodo,
    };
}
