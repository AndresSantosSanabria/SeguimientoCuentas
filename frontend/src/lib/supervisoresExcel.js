import { dependenciaLabel } from '@/lib/dependencias';
import { estadoLabel } from '@/lib/estados';
import { cuentasAlDia, cuentasRepresadas } from '@/lib/supervisores';
import { buildCuentasDetalle, filtrosCorte, hojaCuentas } from '@/lib/cuentasExcel';

const COLUMNAS_RESUMEN = [
    'Secretarías',
    'Supervisor',
    'Contratos',
    'Cuentas radicadas',
    'Exigibles al corte',
    'Cuentas a tiempo',
    'Cuentas represadas',
    'Contratos con mora',
    'Avance declarado promedio %',
    'Avance certificado promedio %',
];
const ANCHOS_RESUMEN = [34, 30, 10, 16, 16, 16, 17, 16, 22, 23];
const COLUMNAS_CONTRATOS = [
    'Supervisor',
    'Secretaría',
    'No. contrato',
    'Contratista',
    'Estado del contrato',
    'Fecha inicio',
    'Fecha fin',
    'Supervisiones',
    'Cuentas radicadas',
    'Exigibles al corte',
    'Cuentas a tiempo',
    'Cuentas represadas',
    'Avance declarado %',
    'Avance certificado %',
    'Siguiente paso',
];
const ANCHOS_CONTRATOS = [30, 26, 16, 30, 30, 12, 12, 12, 16, 16, 15, 17, 18, 19, 26];
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function promedio(valores) {
    if (valores.length === 0)
        return 0;
    return Math.round((valores.reduce((sum, value) => sum + value, 0) / valores.length) * 10) / 10;
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
function filaResumen(supervisor) {
    const contratos = supervisor.contratos;
    return [
        supervisor.secretarias.join(' · ') || '—',
        supervisor.label,
        supervisor.value,
        supervisor.radicadas,
        supervisor.exigibles,
        supervisor.alDia,
        supervisor.represadas,
        contratos.filter((contrato) => cuentasRepresadas(contrato) > 0).length,
        promedio(contratos.map((contrato) => num(contrato.avanceDeclarado))),
        promedio(contratos.map((contrato) => num(contrato.porcentajeAvance))),
    ];
}
function filasContratos(supervisor) {
    return supervisor.contratos.map((contrato) => [
        supervisor.label,
        dependenciaLabel(contrato),
        contrato.noContrato,
        contrato.contratista,
        estadoLabel(contrato.idEstadoActual, contrato.estadoActual),
        contrato.fechaInicio,
        contrato.fechaFin,
        num(contrato.totalSupervisiones),
        num(contrato.cuentasRegistradas),
        num(contrato.cuentasExigibles),
        cuentasAlDia(contrato),
        cuentasRepresadas(contrato),
        num(contrato.avanceDeclarado),
        num(contrato.porcentajeAvance),
        contrato.siguientePaso ?? '—',
    ]);
}
/** Hoja con un renglón por contrato asignado; la usan el libro completo y el de un supervisor. */
function hojaContratos(utils, filas) {
    const hoja = utils.aoa_to_sheet([COLUMNAS_CONTRATOS, ...filas]);
    hoja['!cols'] = COLUMNAS_CONTRATOS.map((_, index) => ({ wch: ANCHOS_CONTRATOS[index] ?? 16 }));
    return hoja;
}
/**
 * Libro con lo que muestra la tarjeta «Contratos por supervisor», pero completo:
 * una hoja de resumen (todos los supervisores del filtro, no solo los del gráfico)
 * y otra con un renglón por contrato asignado.
 */
export function construirLibroSupervisores(utils, supervisores) {
    const resumen = [COLUMNAS_RESUMEN, ...supervisores.map(filaResumen)];
    const hojaResumen = utils.aoa_to_sheet(resumen);
    hojaResumen['!cols'] = COLUMNAS_RESUMEN.map((_, index) => ({ wch: ANCHOS_RESUMEN[index] ?? 16 }));
    const detalles = supervisores.flatMap(filasContratos);
    const libro = utils.book_new();
    utils.book_append_sheet(libro, hojaResumen, 'Resumen supervisores');
    utils.book_append_sheet(libro, hojaContratos(utils, detalles), 'Contratos por supervisor');
    return { libro, contratos: detalles.length };
}
export async function descargarSupervisoresExcel(supervisores, hoy = new Date()) {
    if (supervisores.length === 0)
        return 0;
    const { utils, writeFileXLSX } = await import('xlsx');
    const { libro, contratos } = construirLibroSupervisores(utils, supervisores);
    const partes = ['contratos-por-supervisor', `${supervisores.length}-supervisores`];
    if (supervisores.length === 1)
        partes.push(slug(supervisores[0].label));
    partes.push(new Date(hoy).toISOString().slice(0, 10));
    writeFileXLSX(libro, `${partes.join('_')}.xlsx`);
    return contratos;
}
/**
 * Libro del supervisor abierto en la ventana de detalle: hoja «Contratos» con sus
 * contratos asignados y hoja «Cuentas» con una fila por cuota vencida a la fecha
 * de cada uno —radicada con su estado real, o pendiente sin radicar—, tal como la
 * entrega el libro de Analítica.
 */
export function construirLibroSupervisorDetalle(utils, supervisor, filasCuentas) {
    const libro = utils.book_new();
    utils.book_append_sheet(libro, hojaContratos(utils, filasContratos(supervisor)), 'Contratos');
    utils.book_append_sheet(libro, hojaCuentas(utils, filasCuentas), 'Cuentas');
    return libro;
}
/** Cuotas vencidas a la fecha (radicadas y pendientes) de los contratos del supervisor. */
export function cuentasSupervisor(supervisor, hoy = new Date()) {
    return buildCuentasDetalle(supervisor?.contratos ?? [], filtrosCorte(hoy), hoy);
}
export async function descargarSupervisorDetalleExcel(supervisor, hoy = new Date()) {
    const contratos = supervisor?.contratos ?? [];
    if (contratos.length === 0)
        return null;
    const { utils, writeFileXLSX } = await import('xlsx');
    const cuentas = cuentasSupervisor(supervisor, hoy);
    const nombre = `contratos-supervisor_${slug(supervisor.label)}_${new Date(hoy).toISOString().slice(0, 10)}.xlsx`;
    writeFileXLSX(construirLibroSupervisorDetalle(utils, supervisor, cuentas), nombre);
    return { nombre, contratos: contratos.length, cuentas: cuentas.length };
}
