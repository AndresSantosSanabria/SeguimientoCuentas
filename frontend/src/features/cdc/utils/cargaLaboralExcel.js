import { nombreBloque } from '@/features/cdc/utils/cargaLaboral';
import { formatDateTime } from '@/shared/utils';

/**
 * Libro de «Carga laboral»: evidencia de lo que el usuario conectado gestionó y cuánto tiempo
 * tuvo cada cuenta en sus manos.
 *  - hoja «Movimientos»: un renglón por estadía (recibido de → entregado a, con fechas y días);
 *  - hoja «Resumen»: totales por cuenta y un total general.
 */
const COLUMNAS_MOVIMIENTOS = [
  'Contrato',
  'Contratista',
  'Cuenta',
  'Bloque',
  'Estado',
  'Recibido de',
  'Recibido el',
  'Entregado a',
  'Entregado el',
  'Días en mis manos',
];
const ANCHOS_MOVIMIENTOS = [20, 30, 16, 20, 26, 26, 20, 26, 20, 16];

const COLUMNAS_RESUMEN = [
  'Contrato',
  'Contratista',
  'Cuenta',
  'Movimientos',
  'Días totales',
  'Días promedio',
];
const ANCHOS_RESUMEN = [20, 34, 18, 14, 14, 16];

function conRol(nombre, rol) {
  if (!nombre || nombre === '—') return '—';
  return rol ? `${nombre} (${rol})` : nombre;
}

function filaMovimiento(tramo) {
  return [
    tramo.contrato,
    tramo.contratista,
    tramo.cuenta,
    nombreBloque(tramo.bloque),
    tramo.estado,
    conRol(tramo.recibidoDe, tramo.rolRecibidoDe),
    formatDateTime(tramo.recibidoEl),
    tramo.enManos ? '— en mis manos —' : conRol(tramo.entregadoA, tramo.rolEntregadoA),
    tramo.enManos ? '— sigue aquí —' : formatDateTime(tramo.entregadoEl),
    Math.round(tramo.dias * 100) / 100,
  ];
}

function hojaMovimientos(utils, movimientos) {
  const hoja = utils.aoa_to_sheet([COLUMNAS_MOVIMIENTOS, ...movimientos.map(filaMovimiento)]);
  hoja['!cols'] = COLUMNAS_MOVIMIENTOS.map((_, index) => ({ wch: ANCHOS_MOVIMIENTOS[index] ?? 16 }));
  return hoja;
}

function hojaResumen(utils, resumen, totales) {
  const filas = [
    [`Carga laboral de ${totales.usuario || '—'}`],
    [],
    COLUMNAS_RESUMEN,
    ...resumen.map((item) => [
      item.contrato,
      item.contratista,
      item.cuenta,
      item.movimientos,
      item.dias,
      item.promedio,
    ]),
    [],
    ['TOTAL', '', '', totales.movimientos, totales.dias, ''],
  ];
  const hoja = utils.aoa_to_sheet(filas);
  hoja['!cols'] = COLUMNAS_RESUMEN.map((_, index) => ({ wch: ANCHOS_RESUMEN[index] ?? 16 }));
  return hoja;
}

export function construirLibroCargaLaboral(utils, carga) {
  const libro = utils.book_new();
  utils.book_append_sheet(libro, hojaMovimientos(utils, carga.movimientos), 'Movimientos');
  utils.book_append_sheet(libro, hojaResumen(utils, carga.resumen, carga.totales), 'Resumen');
  return libro;
}

function slug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'usuario';
}

/**
 * Genera y descarga el .xlsx de carga laboral. La librería se importa de forma diferida: solo se
 * baja si el usuario pulsa el botón. Devuelve el número de movimientos exportados (0 = nada).
 */
export async function descargarCargaLaboralExcel(carga, hoy = new Date()) {
  if (!carga || carga.movimientos.length === 0) return 0;
  const { utils, writeFileXLSX } = await import('xlsx');
  const libro = construirLibroCargaLaboral(utils, carga);
  const fecha = new Date(hoy).toISOString().slice(0, 10);
  writeFileXLSX(libro, `carga-laboral_${slug(carga.totales.usuario)}_${fecha}.xlsx`);
  return carga.movimientos.length;
}
