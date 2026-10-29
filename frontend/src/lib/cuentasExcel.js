import { MESES, cortePeriodo, mesesEsperados, plusMonths, rangoMeses } from '@/lib/cuentasSecretaria';
import { dependenciaLabel } from '@/lib/dependencias';
import { estadoLabel } from '@/lib/estados';
import { parseDateOnly, startOfDay } from '@/lib/format';

export const CUENTAS_EXCEL_COLUMNAS = [
    'Secretaría',
    'No. contrato',
    'Contratista',
    'Mes pendiente',
    'Estado actual',
    'Supervisor',
    'Fecha inicio',
    'Fecha fin',
    'Cuentas exigibles al corte',
    'Cuentas registradas',
    'Cuotas pendientes',
    'Cuentas en mora',
    'Avance %',
];
const ANCHOS_COLUMNA = [26, 16, 30, 16, 28, 24, 12, 12, 15, 14, 14, 13, 9];
const LIMITE_MESES = 2400;
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
/**
 * Detalle de cuentas pendientes: una fila por cada cuota exigible y no radicada
 * (contrato × mes) dentro del rango de meses seleccionado.
 *
 * Criterio, igual que el gráfico de «Cuentas por secretaría»:
 *  - exigible: la cuota del mes k cerró su periodo antes del corte;
 *  - radicada: los primeros `cuentasRegistradas` meses se consideran cubiertos;
 *  - pendiente: exigible y con k >= cuentasRegistradas.
 */
export function buildCuentasPendientesDetalle(contratos, filtros, hoy = new Date()) {
    const corte = cortePeriodo(filtros.anio, filtros.mes, startOfDay(hoy), filtros.mesHasta ?? null);
    const { desde, hasta } = rangoMeses(filtros.mes, filtros.mesHasta);
    const filas = [];
    for (const contrato of contratos) {
        const secretaria = dependenciaLabel(contrato);
        if (filtros.secretaria && secretaria !== filtros.secretaria)
            continue;
        const inicio = parseDateOnly(contrato.fechaInicio);
        const fin = parseDateOnly(contrato.fechaFin);
        if (!inicio || !fin || fin.getTime() < inicio.getTime())
            continue;
        const registradas = Math.max(0, num(contrato.cuentasRegistradas));
        const periodosPendientes = [];
        const esperadas = mesesEsperados(inicio, fin);
        let exigibles = 0;
        for (let k = 0; k < esperadas && k < LIMITE_MESES; k++) {
            const periodo = plusMonths(inicio, k);
            const cierre = plusMonths(inicio, k + 1);
            cierre.setDate(cierre.getDate() - 1);
            const limite = cierre.getTime() > fin.getTime() ? fin : cierre;
            if (limite.getTime() > corte.getTime())
                break;
            exigibles += 1;
            if (k >= registradas)
                periodosPendientes.push(periodo);
        }
        if (exigibles === 0 || periodosPendientes.length === 0)
            continue;
        const pendientesTotal = exigibles - Math.min(registradas, exigibles);
        for (const periodo of periodosPendientes) {
            const anioPeriodo = periodo.getFullYear();
            const mesPeriodo = periodo.getMonth() + 1;
            if (anioPeriodo !== filtros.anio || mesPeriodo < desde || mesPeriodo > hasta)
                continue;
            filas.push({
                orden: anioPeriodo * 12 + mesPeriodo,
                valores: [
                    secretaria,
                    contrato.noContrato,
                    contrato.contratista,
                    `${MESES[mesPeriodo - 1]} ${anioPeriodo}`,
                    estadoLabel(contrato.idEstadoActual, contrato.estadoActual),
                    contrato.supervisor?.trim() || '—',
                    contrato.fechaInicio,
                    contrato.fechaFin,
                    exigibles,
                    registradas,
                    pendientesTotal,
                    num(contrato.cuentasEnMora),
                    num(contrato.porcentajeAvance),
                ],
            });
        }
    }
    filas.sort((a, b) => a.valores[0].localeCompare(b.valores[0], 'es') ||
        String(a.valores[1] ?? '').localeCompare(String(b.valores[1] ?? ''), 'es') ||
        a.orden - b.orden);
    return filas.map((fila) => fila.valores);
}
function nombreArchivo(filtros, hoy) {
    const { desde, hasta } = rangoMeses(filtros.mes, filtros.mesHasta);
    const rango = `${filtros.anio}-${String(desde).padStart(2, '0')}-a-${filtros.anio}-${String(hasta).padStart(2, '0')}`;
    const partes = ['cuentas-pendientes', rango];
    if (filtros.secretaria)
        partes.push(slug(filtros.secretaria));
    partes.push(new Date(hoy).toISOString().slice(0, 10));
    return `${partes.join('_')}.xlsx`;
}
/**
 * Construye el libro de SheetJS (hoja «Cuentas pendientes» con anchos de columna)
 * a partir de las filas ya calculadas. Recibe `utils` de la librería xlsx para
 * mantener la importación diferida (y poder validarlo en tests de Node).
 */
export function construirLibroCuentas(utils, filas) {
    const hoja = utils.aoa_to_sheet([CUENTAS_EXCEL_COLUMNAS, ...filas]);
    hoja['!cols'] = CUENTAS_EXCEL_COLUMNAS.map((_, index) => ({ wch: ANCHOS_COLUMNA[index] ?? 16 }));
    const libro = utils.book_new();
    utils.book_append_sheet(libro, hoja, 'Cuentas pendientes');
    return libro;
}
/**
 * Genera y descarga el archivo .xlsx con SheetJS. La librería se importa de forma
 * diferida: solo se descarga si el usuario pulsa el botón.
 * Devuelve el número de filas escritas (0 = nada que descargar).
 */
export async function descargarCuentasPendientesExcel(contratos, filtros, hoy = new Date()) {
    const filas = buildCuentasPendientesDetalle(contratos, filtros, hoy);
    if (filas.length === 0)
        return 0;
    const { utils, writeFileXLSX } = await import('xlsx');
    const libro = construirLibroCuentas(utils, filas);
    writeFileXLSX(libro, nombreArchivo(filtros, hoy));
    return filas.length;
}
