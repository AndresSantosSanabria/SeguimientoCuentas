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
    const anios = [];
    for (const contrato of contratos) {
        const inicio = parseDateOnly(contrato.fechaInicio);
        const fin = parseDateOnly(contrato.fechaFin);
        if (inicio && inicio.getFullYear() >= 1900 && inicio.getFullYear() <= 2100) anios.push(inicio.getFullYear());
        if (fin && fin.getFullYear() >= 1900 && fin.getFullYear() <= 2100) anios.push(fin.getFullYear());
    }
    if (anios.length === 0) return [new Date().getFullYear()];
    const desde = Math.min(...anios);
    const hasta = Math.max(new Date().getFullYear(), ...anios);
    return Array.from({ length: hasta - desde + 1 }, (_, index) => hasta - index);
}
export function contratoEnAnios(contrato, anios) {
    if (!Array.isArray(anios) || anios.length === 0) return true;
    const inicio = parseDateOnly(contrato.fechaInicio);
    const fin = parseDateOnly(contrato.fechaFin) ?? inicio;
    if (!inicio || !fin || fin < inicio) return false;
    return anios.some((anio) => anio >= inicio.getFullYear() && anio <= fin.getFullYear());
}
export function secretariasDisponibles(contratos) {
    const labels = new Set();
    for (const contrato of contratos) {
        labels.add(dependenciaLabel(contrato));
    }
    return [...labels].sort((a, b) => a.localeCompare(b, 'es'));
}
/**
 * Lista de secretarías seleccionadas; vacía = todas.
 * `filtros.secretaria` (texto único) sigue valiendo para los llamados antiguos.
 */
export function seleccionSecretarias(filtros) {
    if (Array.isArray(filtros.secretarias))
        return filtros.secretarias;
    return filtros.secretaria ? [filtros.secretaria] : [];
}
export function pasaSecretaria(label, filtros) {
    const seleccion = seleccionSecretarias(filtros);
    return seleccion.length === 0 || seleccion.includes(label);
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
const FECHA_SIN_INICIO = new Date(1900, 0, 1);
/**
 * Rango de calendario [desde, hasta] con precisión de día, desde los inputs
 * `desdeFecha` / `hastaFecha`. `null` = no hay rango y manda Mes/Hasta.
 * Un extremo vacío se abre al principio del histórico o a hoy, y si vienen
 * invertidos se intercambian.
 */
export function rangoFechas(filtros, hoy = startOfDay(new Date())) {
    const inicial = fechaContratoValida(filtros.desdeFecha);
    const final = fechaContratoValida(filtros.hastaFecha);
    if (!inicial && !final)
        return null;
    const desde = inicial ?? FECHA_SIN_INICIO;
    const hasta = final ?? startOfDay(hoy);
    return desde.getTime() <= hasta.getTime()
        ? { desde, hasta }
        : { desde: hasta, hasta: desde };
}
/** Dos intervalos de días se solapan cuando cada uno empieza antes de que el otro termine. */
export function solapaRango(inicio, fin, rango) {
    return inicio.getTime() <= rango.hasta.getTime() && fin.getTime() >= rango.desde.getTime();
}
/** Cuota que entra en el cálculo: entre fechas si hay rango, si no en los meses pedidos. */
export function cuotaVisible(cuota, { anio, anios, desde, hasta, rango }) {
    if (rango)
        return solapaRango(cuota.inicio, cuota.fin, rango);
    const seleccion = Array.isArray(anios) ? anios : [];
    return (seleccion.length === 0 ? cuota.anio <= Number(anio) : seleccion.includes(cuota.anio))
        && cuota.mes >= desde && cuota.mes <= hasta;
}
/**
 * Corte real del cálculo. Con rango de fechas el corte es «Hasta» (tope hoy),
 * así que radicadas + pendientes cuadran con el mismo número que ve el gráfico.
 */
export function corteEfectivo(filtros, hoy = startOfDay(new Date())) {
    const inicioDia = startOfDay(hoy);
    const rango = rangoFechas(filtros, inicioDia);
    if (!rango) {
        const anios = Array.isArray(filtros.anios) ? filtros.anios : [];
        return cortePeriodo(anios.length ? Math.max(...anios) : filtros.anio,
                filtros.mes, inicioDia, filtros.mesHasta ?? null);
    }
    return rango.hasta.getTime() < inicioDia.getTime() ? rango.hasta : inicioDia;
}
/** Etiqueta del período en pantalla: el rango de fechas si está activo, si no el mes/año. */
export function periodoFiltroLabel(filtros, hoy = new Date()) {
    const rango = rangoFechas(filtros, startOfDay(hoy));
    if (!rango) {
        const anios = Array.isArray(filtros.anios) ? filtros.anios : [];
        const etiquetaAnios = anios.length === 0 ? 'Todos los años' : anios.slice().sort((a, b) => a - b).join(', ');
        const { desde, hasta } = rangoMeses(filtros.mes, filtros.mesHasta ?? null);
        const etiquetaMes = desde === 1 && hasta === 12 ? '' : desde === hasta
            ? ` · ${MESES[desde - 1]}` : ` · ${MESES[desde - 1]}–${MESES[hasta - 1]}`;
        return `${etiquetaAnios}${etiquetaMes}`;
    }
    const dia = (value) => `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
    if (rango.desde.getTime() === FECHA_SIN_INICIO.getTime())
        return `Hasta el ${dia(rango.hasta)}`;
    if (rango.hasta.getTime() === startOfDay(hoy).getTime())
        return `Desde el ${dia(rango.desde)}`;
    return `${dia(rango.desde)} → ${dia(rango.hasta)}`;
}
/** Fechas de contrato que tienen sentido; descarta los digitados mal (p. ej. año 2203). */
export function fechaContratoValida(value) {
    const fecha = parseDateOnly(value);
    if (!fecha)
        return null;
    const anio = fecha.getFullYear();
    return anio >= 1900 && anio <= 2100 ? fecha : null;
}
const LIMITE_CUOTAS = 2400;
/**
 * Cuotas del contrato que ya vencieron al corte. Sin periodo recorre todo el
 * calendario acumulado hasta esa fecha, que es lo que mide el gráfico
 * «Cuentas por secretaría»; con `rango` toma las cuotas que caen entre dos
 * fechas exactas y con `anio`/`desde`/`hasta`, las de los meses elegidos.
 * Cada cuota lleva su ventana de días (`inicio`–`fin`) para poder filtrarla.
 */
export function cuotasEnPeriodo(inicio, fin, corte, { anio, desde = 1, hasta = 12, rango } = {}) {
    const cuotas = [];
    if (!inicio || !fin || fin.getTime() < inicio.getTime() || corte.getTime() < inicio.getTime())
        return cuotas;
    const anioFiltro = Number(anio);
    const esperadas = mesesEsperados(inicio, fin);
    for (let k = 0; k < esperadas && k < LIMITE_CUOTAS; k++) {
        const periodo = plusMonths(inicio, k);
        const cierre = plusMonths(inicio, k + 1);
        cierre.setDate(cierre.getDate() - 1);
        const limite = cierre.getTime() > fin.getTime() ? fin : cierre;
        if (limite.getTime() > corte.getTime())
            break;
        const mes = periodo.getMonth() + 1;
        if (rango) {
            if (!solapaRango(periodo, limite, rango))
                continue;
        }
        else {
            if (Number.isFinite(anioFiltro) && periodo.getFullYear() !== anioFiltro)
                continue;
            if (mes < desde || mes > hasta)
                continue;
        }
        cuotas.push({
            indice: k,
            anio: periodo.getFullYear(),
            mes,
            etiqueta: `${MESES[mes - 1]} ${periodo.getFullYear()}`,
            inicio: periodo,
            fin: limite,
        });
    }
    return cuotas;
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
function cubiertasScalar(contrato, calendario) {
    const hasta = Math.min(Math.max(0, contrato.cuentasRegistradas ?? 0), calendario.length);
    return new Set(calendario.slice(0, hasta).map((cuota) => cuota.indice));
}
/**
 * Reparte las cuentas radicadas sobre el calendario real: cada una se para en la
 * cuota cuyo vencimiento cubre su propio período (`fechaInicio`–`fechaFin`). Así
 * el libro no escribe una cuenta de agosto en la fila de enero. Se recorre en el
 * mismo orden de los períodos, por eso un solo puntero basta.
 */
export function emparejarCuentas(calendario, radicadas) {
    const porCuota = new Map();
    const sobrantes = [];
    let puntero = 0;
    for (const cuenta of radicadas) {
        const desde = parseDateOnly(cuenta.fechaInicio);
        const hasta = parseDateOnly(cuenta.fechaFin) ?? desde;
        let asignada = null;
        for (let i = puntero; i < calendario.length; i++) {
            const cuota = calendario[i];
            if (!desde || !hasta)
                break;
            if (cuota.fin.getTime() < desde.getTime())
                continue;
            if (cuota.inicio.getTime() > hasta.getTime())
                break;
            if (porCuota.has(cuota.indice))
                continue;
            asignada = cuota;
            puntero = i;
            break;
        }
        if (!asignada) {
            sobrantes.push(cuenta);
            continue;
        }
        porCuota.set(asignada.indice, cuenta);
    }
    return { porCuota, sobrantes };
}
/** Cuentas radicadas ordenadas como las entiende el backend: por período y luego por id. */
export function cuentasRadicadas(contrato) {
    return [...(contrato.cuentasDetalle ?? [])].sort((a, b) => String(a.fechaInicio ?? '').localeCompare(String(b.fechaInicio ?? '')) ||
        (Number.isFinite(a.idInformeActividad) ? a.idInformeActividad : 0) - (Number.isFinite(b.idInformeActividad) ? b.idInformeActividad : 0));
}
/** Índices de cuota que ya tienen cuenta radicada; sin detalle real vale el conteo declarado. */
export function cuentasCubiertas(contrato, calendario) {
    if (!contrato.cuentasDetalle?.length)
        return cubiertasScalar(contrato, calendario);
    return new Set(emparejarCuentas(calendario, cuentasRadicadas(contrato)).porCuota.keys());
}
export function buildCuentasSecretaria(contratos, filtros, hoy = new Date()) {
    const inicioDia = startOfDay(hoy);
    const rango = rangoFechas(filtros, inicioDia);
    const corte = corteEfectivo(filtros, inicioDia);
    const mapa = new Map();
    let totalCompletadas = 0;
    let totalPendientes = 0;
    let totalExigibles = 0;
    let contratosConDeuda = 0;
    let contratosEnPeriodo = 0;
    for (const contrato of contratos) {
        const label = dependenciaLabel(contrato);
        if (!pasaSecretaria(label, filtros))
            continue;
        const inicio = fechaContratoValida(contrato.fechaInicio);
        const fin = fechaContratoValida(contrato.fechaFin);
        if (!inicio || !fin || fin.getTime() < inicio.getTime())
            continue;
        const calendario = cuotasEnPeriodo(inicio, fin, corte);
        if (calendario.length <= 0)
            continue;
        // Es una foto acumulada al corte; el selector global de año ya restringió
        // los contratos al conjunto de años pedido y no se vuelve a cortar aquí.
        const visibles = rango
            ? calendario.filter((cuota) => solapaRango(cuota.inicio, cuota.fin, rango))
            : calendario;
        if (visibles.length <= 0)
            continue;
        const cubiertas = cuentasCubiertas(contrato, calendario);
        const exigibles = visibles.length;
        const completadas = visibles.reduce((sum, cuota) => sum + (cubiertas.has(cuota.indice) ? 1 : 0), 0);
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
    if (seleccionSecretarias(filtros).length === 0 && ordenadas.length > TOP_SECRETARIAS) {
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
