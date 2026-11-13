import { ETAPAS } from '@/lib/leadTime';

/**
 * Libro del «Desglose del Lead Time por Proceso y Etapa»:
 *  - hoja «Resumen»: la misma tabla del diagrama (Proceso × etapas + Lead Time Total),
 *    pero con fórmulas SUMIFS que leen la hoja «Datos», así que es una tabla dinámica:
 *    al filtrar o editar «Datos» el resumen se recalcula;
 *  - hoja «Datos»: un renglón por cada tramo de tiempo de cada cuenta (el «por qué»
 *    de cada cifra: en qué bloque, qué estado, qué etapa y cuántos días).
 */
const COLUMNAS_RESUMEN = ['Proceso', ...ETAPAS.map((etapa) => etapa.label), 'Lead Time Total'];
const ANCHOS_RESUMEN = [26, 22, 15, 16, 13, 18];
const COLUMNAS_DATOS = ['Proceso', 'Cuenta', 'Contrato', 'Estado', 'Etapa', 'Tipo de tiempo', 'Desde', 'Hasta', 'Días'];
const ANCHOS_DATOS = [26, 22, 18, 26, 22, 15, 20, 20, 10];
const NOMBRE_HOJA_DATOS = 'Datos';

function celda(valor, formula) {
    return formula ? { t: typeof valor === 'number' ? 'n' : 's', v: valor, f: formula } : valor;
}

/** Los valores se guardan con 4 decimales: suficiente para verlos y para que la suma cierre. */
function dias(valor) {
    return Math.round((valor ?? 0) * 10_000) / 10_000;
}

/** Hoja «Resumen»: valores calculados aquí y fórmula SUMIFS contra «Datos» para que Excel recalcule. */
function hojaResumen(utils, rows) {
    const filas = [COLUMNAS_RESUMEN];
    rows.forEach((fila, index) => {
        const numeroFila = index + 2;
        const valores = [fila.label];
        for (const etapa of ETAPAS) {
            const columna = String.fromCharCode(66 + ETAPAS.indexOf(etapa)); // B..E
            valores.push(celda(
                dias(fila[etapa.id]),
                `SUMIFS(${NOMBRE_HOJA_DATOS}!$I:$I,${NOMBRE_HOJA_DATOS}!$A:$A,$A${numeroFila},${NOMBRE_HOJA_DATOS}!$E:$E,${columna}$1)`,
            ));
        }
        valores.push(celda(dias(fila.total), `SUM(B${numeroFila}:E${numeroFila})`));
        filas.push(valores);
    });
    const primeraFila = 2;
    const ultimaFila = rows.length + 1;
    const total = ['TOTAL'];
    for (const letra of ['B', 'C', 'D', 'E', 'F']) {
        const suma = rows.reduce((sum, fila) => {
            const columna = letra === 'F' ? 'total' : ETAPAS[letra.charCodeAt(0) - 66].id;
            return sum + (fila[columna] ?? 0);
        }, 0);
        total.push(celda(dias(suma), `SUM(${letra}${primeraFila}:${letra}${ultimaFila})`));
    }
    filas.push(total);

    const hoja = utils.aoa_to_sheet(filas);
    hoja['!cols'] = COLUMNAS_RESUMEN.map((_, index) => ({ wch: ANCHOS_RESUMEN[index] ?? 16 }));
    return hoja;
}

function hojaDatos(utils, detalle) {
    const filas = [COLUMNAS_DATOS, ...detalle.map((tramo) => [
        tramo.proceso,
        tramo.cuenta,
        tramo.contrato,
        tramo.estado,
        ETAPAS.find((etapa) => etapa.id === tramo.etapa)?.label ?? tramo.etapa,
        ETAPAS.find((etapa) => etapa.id === tramo.etapa)?.tipo === 'valor' ? 'Con valor' : 'Muerto',
        tramo.desde ?? '—',
        tramo.hasta ?? '—',
        tramo.dias,
    ])];
    const hoja = utils.aoa_to_sheet(filas);
    hoja['!cols'] = COLUMNAS_DATOS.map((_, index) => ({ wch: ANCHOS_DATOS[index] ?? 16 }));
    return hoja;
}

export function construirLibroLeadTime(utils, leadTime) {
    const libro = utils.book_new();
    utils.book_append_sheet(libro, hojaResumen(utils, leadTime.rows), 'Resumen');
    utils.book_append_sheet(libro, hojaDatos(utils, leadTime.detalle), NOMBRE_HOJA_DATOS);
    return libro;
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

export async function descargarLeadTimeExcel(leadTime, alcance, hoy = new Date()) {
    if (!leadTime || leadTime.rows.length === 0)
        return 0;
    const { utils, writeFileXLSX } = await import('xlsx');
    const libro = construirLibroLeadTime(utils, leadTime);
    const fecha = new Date(hoy).toISOString().slice(0, 10);
    const partes = ['lead-time-por-proceso-y-etapa', slug(alcance ?? 'curso'), fecha];
    writeFileXLSX(libro, `${partes.join('_')}.xlsx`);
    return leadTime.detalle.length;
}
