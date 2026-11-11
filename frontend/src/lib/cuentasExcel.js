import { MESES, cuotaVisible, cuentasCubiertas, cuentasRadicadas, cuotasEnPeriodo, emparejarCuentas, fechaContratoValida, pasaSecretaria, rangoFechas, rangoMeses, corteEfectivo, seleccionSecretarias, solapaRango } from '@/lib/cuentasSecretaria';
import { dependenciaLabel } from '@/lib/dependencias';
import { coincideGrupoEstado, estadoLabel } from '@/lib/estados';
import { coincideTexto, parseDateOnly, startOfDay } from '@/lib/format';

export const CUENTAS_EXCEL_COLUMNAS = [
    'Secretaría',
    'No. contrato',
    'Contratista',
    'Situación',
    'Cuota (mes)',
    'Período de la cuenta',
    'Nº informe',
    'Tipo de informe',
    'Estado de la cuenta',
    'Fecha del estado',
    'Siguiente paso',
    'Requiere SECOP',
    'Firmada',
    'Cuenta en curso',
    'Supervisor',
    'Estado del contrato',
    'Fecha inicio',
    'Fecha fin',
    'Cuotas vencidas',
    'Cuentas radicadas',
    'Cuotas pendientes',
    'En mora al corte',
    'Avance %',
];
const ANCHOS_COLUMNA = [26, 16, 30, 22, 16, 26, 10, 18, 28, 14, 26, 11, 9, 12, 24, 28, 12, 12, 15, 11, 12, 10, 9];
export const SITUACIONES = [
    { valor: 'todas', label: 'Radicadas y pendientes' },
    { valor: 'radicadas', label: 'Solo radicadas' },
    { valor: 'pendientes', label: 'Solo pendientes' },
];
/** Hasta dónde llega el libro: solo el rango elegido o todo lo vencido hasta el corte. */
export const ALCANCES = [
    { valor: 'periodo', label: 'Solo las cuotas del período' },
    { valor: 'corte', label: 'Todo lo vencido hasta el corte' },
];
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function si(value) {
    return value ? 'Sí' : 'No';
}
function slug(texto) {
    return String(texto)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}
function periodoCuenta(cuenta) {
    if (!cuenta?.fechaInicio && !cuenta?.fechaFin)
        return '—';
    return `${cuenta.fechaInicio ?? '—'} a ${cuenta.fechaFin ?? '—'}`;
}
function cuotaDe(periodo) {
    const anio = periodo.getFullYear();
    const mes = periodo.getMonth() + 1;
    return { anio, mes, etiqueta: `${MESES[mes - 1]} ${anio}` };
}
/** Una cuenta ya radicada solo entra al libro si su período cae en el periodo pedido. */
function enRango(cuota, anio, desde, hasta) {
    return cuota.anio === anio && cuota.mes >= desde && cuota.mes <= hasta;
}
/** Igual, para una cuenta sin cuota en el calendario: manda su propio período. */
function cuentaEnFiltro(cuenta, filtro) {
    const inicio = parseDateOnly(cuenta.fechaInicio);
    if (!inicio)
        return false;
    if (filtro.rango)
        return solapaRango(inicio, parseDateOnly(cuenta.fechaFin) ?? inicio, filtro.rango);
    const cuota = cuotaDe(inicio);
    const anios = Array.isArray(filtro.anios) ? filtro.anios : [];
    return (anios.length === 0 ? cuota.anio <= Number(filtro.anio) : anios.includes(cuota.anio))
        && cuota.mes >= filtro.desde && cuota.mes <= filtro.hasta;
}
function clave(cuota) {
    return cuota.anio * 12 + cuota.mes;
}
/**
 * Libro de cuentas: una fila por cuota vencida del contrato. Cada cuota lleva la
 * cuenta radicada cuyo período la cubre (con su estado y siguiente paso reales,
 * tal como los entrega /api/contratos); las que no tienen cuenta quedan como
 * pendientes sin radicar.
 *
 * El calendario lo calcula `cuotasEnPeriodo`, la misma función del gráfico
 * «Cuentas por secretaría», siempre desde el inicio del contrato hasta el corte,
 * que es lo que hace que radicadas + pendientes cuadren con la pantalla. El
 * alcance solo decide qué cuotas se escriben: con rango de fechas entran las que
 * caen entre las dos fechas elegidas —y el corte pasa a ser la segunda—; si no,
 * los meses de Mes/Hasta o todo lo vencido hasta el corte. Las cuentas radicadas
 * que no cubre ninguna cuota del calendario se listan al final como
 * «fuera del calendario exigible».
 */
export function buildCuentasDetalle(contratos, filtros, hoy = new Date()) {
    const rango = rangoFechas(filtros, startOfDay(hoy));
    const corte = corteEfectivo(filtros, startOfDay(hoy));
    const { desde, hasta } = rangoMeses(filtros.mes, filtros.mesHasta);
    const enCorte = !rango && (filtros.alcance ?? 'periodo') === 'corte';
    const situacion = filtros.situacion ?? 'todas';
    const pideRadicadas = situacion !== 'pendientes';
    const pidePendientes = situacion !== 'radicadas';
    const filas = [];
    for (const contrato of contratos) {
        const secretaria = dependenciaLabel(contrato);
        if (!pasaSecretaria(secretaria, filtros))
            continue;
        if (!coincideGrupoEstado(contrato.idEstadoActual, filtros.estado))
            continue;
        if (!coincideTexto(filtros.texto, contrato.noContrato, contrato.contratista, contrato.supervisor))
            continue;
        const inicio = fechaContratoValida(contrato.fechaInicio);
        const fin = fechaContratoValida(contrato.fechaFin);
        if (!inicio || !fin || fin.getTime() < inicio.getTime())
            continue;
        const cuotas = cuotasEnPeriodo(inicio, fin, corte);
        const radicadas = cuentasRadicadas(contrato);
        const { porCuota, sobrantes } = emparejarCuentas(cuotas, radicadas);
        const cubiertas = cuentasCubiertas(contrato, cuotas);
        const visibles = cuotas.filter((cuota) => enCorte
            ? cuotaVisible(cuota, { anio: filtros.anio, anios: filtros.anios, desde: 1, hasta: 12, rango })
            : cuotaVisible(cuota, { anio: filtros.anio, anios: filtros.anios, desde, hasta, rango }));
        if (visibles.length === 0 && radicadas.length === 0)
            continue;
        const pendientes = cuotas.length - cubiertas.size;
        const contexto = [
            secretaria,
            contrato.noContrato,
            contrato.contratista,
        ];
        const contadores = [
            contrato.supervisor?.trim() || '—',
            estadoLabel(contrato.idEstadoActual, contrato.estadoActual),
            contrato.fechaInicio,
            contrato.fechaFin,
            cuotas.length,
            num(contrato.cuentasRegistradas),
            pendientes,
            num(contrato.cuentasEnMora),
            num(contrato.porcentajeAvance),
        ];
        visibles.forEach((cuota) => {
            const cuenta = porCuota.get(cuota.indice) ?? null;
            const radicada = cuenta || cubiertas.has(cuota.indice);
            if (radicada && !pideRadicadas)
                return;
            if (!radicada && !pidePendientes)
                return;
            filas.push({
                orden: clave(cuota) * 2,
                valores: [
                    ...contexto,
                    cuenta ? 'Radicada' : radicada ? 'Radicada (sin detalle)' : 'Pendiente (sin radicar)',
                    cuota.etiqueta,
                    cuenta ? periodoCuenta(cuenta) : '— sin radicar —',
                    cuenta ? (cuenta.numInforme ?? cuenta.noInforme ?? '—') : '—',
                    cuenta ? (cuenta.tipoInforme ?? '—') : '—',
                    cuenta ? estadoLabel(cuenta.idEstadoActual, cuenta.estadoActual) : 'No radicada',
                    cuenta ? (cuenta.fechaEstado ?? '—') : '—',
                    cuenta ? (cuenta.siguientePaso ?? '—') : 'Radicar informe de actividades',
                    cuenta ? si(cuenta.requiereSecop) : '—',
                    cuenta ? si(cuenta.firmado) : '—',
                    cuenta?.activa ? 'En curso' : '—',
                    ...contadores,
                ],
            });
        });
        if (!pideRadicadas)
            continue;
        for (const cuenta of sobrantes) {
            const cuota = cuotaDe(parseDateOnly(cuenta.fechaInicio) ?? corte);
            if (!cuentaEnFiltro(cuenta, { anio: filtros.anio, anios: filtros.anios, desde: enCorte ? 1 : desde, hasta: enCorte ? 12 : hasta, rango }))
                continue;
            filas.push({
                orden: clave(cuota) * 2 + 1,
                valores: [
                    ...contexto,
                    'Radicada (fuera del calendario exigible)',
                    cuota.etiqueta,
                    periodoCuenta(cuenta),
                    cuenta.numInforme ?? cuenta.noInforme ?? '—',
                    cuenta.tipoInforme ?? '—',
                    estadoLabel(cuenta.idEstadoActual, cuenta.estadoActual),
                    cuenta.fechaEstado ?? '—',
                    cuenta.siguientePaso ?? '—',
                    si(cuenta.requiereSecop),
                    si(cuenta.firmado),
                    cuenta.activa ? 'En curso' : '—',
                    ...contadores,
                ],
            });
        }
    }
    filas.sort((a, b) => String(a.valores[0]).localeCompare(String(b.valores[0]), 'es') ||
        String(a.valores[1] ?? '').localeCompare(String(b.valores[1] ?? ''), 'es') ||
        a.orden - b.orden);
    return filas.map((fila) => fila.valores);
}
/** Nombre del archivo según los filtros aplicados, para que dos descargas no se pisen. */
export function nombreArchivoCuentas(filtros, hoy = new Date()) {
    const rango = rangoFechas(filtros, startOfDay(hoy));
    const { desde, hasta } = rangoMeses(filtros.mes, filtros.mesHasta);
    const alcance = filtros.alcance ?? 'periodo';
    const partes = [`cuentas-${filtros.situacion ?? 'todas'}`];
    if (rango)
        partes.push(`${filtros.desdeFecha || 'inicio'}-a-${filtros.hastaFecha || 'hoy'}`);
    else partes.push(alcance === 'corte'
        ? `hasta-${filtros.anio}-${String(hasta).padStart(2, '0')}`
        : `${filtros.anio}-${String(desde).padStart(2, '0')}-a-${filtros.anio}-${String(hasta).padStart(2, '0')}`);
    const seleccion = seleccionSecretarias(filtros);
    if (seleccion.length === 1)
        partes.push(slug(seleccion[0]));
    else if (seleccion.length > 1)
        partes.push(`${seleccion.length}-secretarias`);
    if (filtros.estado && filtros.estado !== 'todos')
        partes.push(filtros.estado);
    partes.push(new Date(hoy).toISOString().slice(0, 10));
    return `${partes.join('_')}.xlsx`;
}
/**
 * Filtro «todo lo vencido hasta hoy»: corte en el día, sin rango de fechas y sin
 * recorte de secretaría, estado o texto. Es el que usan los export que no cuelgan
 * de la barra de filtros de Analítica.
 */
export function filtrosCorte(hoy = new Date()) {
    return {
        anio: new Date(hoy).getFullYear(),
        mes: 'todos',
        mesHasta: '',
        alcance: 'corte',
        situacion: 'todas',
        estado: 'todos',
        texto: '',
        secretarias: [],
    };
}
/** Hoja «Cuentas» con anchos, lista para ir sola o dentro de otro libro. */
export function hojaCuentas(utils, filas) {
    const hoja = utils.aoa_to_sheet([CUENTAS_EXCEL_COLUMNAS, ...filas]);
    hoja['!cols'] = CUENTAS_EXCEL_COLUMNAS.map((_, index) => ({ wch: ANCHOS_COLUMNA[index] ?? 16 }));
    return hoja;
}
/**
 * Construye el libro de SheetJS (hoja «Cuentas» con anchos de columna) a partir
 * de las filas ya calculadas. Recibe `utils` de la librería para mantener la
 * importación diferida y poder validarlo fuera del navegador.
 */
export function construirLibroCuentas(utils, filas) {
    const libro = utils.book_new();
    utils.book_append_sheet(libro, hojaCuentas(utils, filas), 'Cuentas');
    return libro;
}
/**
 * Genera y descarga el .xlsx con todas las cuentas del filtro. La librería se
 * importa de forma diferida: solo se baja si el usuario pulsa el botón.
 * Devuelve el número de filas escritas (0 = nada que descargar).
 */
export async function descargarCuentasExcel(contratos, filtros, hoy = new Date()) {
    const filas = buildCuentasDetalle(contratos, filtros, hoy);
    if (filas.length === 0)
        return 0;
    const { utils, writeFileXLSX } = await import('xlsx');
    writeFileXLSX(construirLibroCuentas(utils, filas), nombreArchivoCuentas(filtros, hoy));
    return filas.length;
}
