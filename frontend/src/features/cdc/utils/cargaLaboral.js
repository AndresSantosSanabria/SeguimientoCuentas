import { BLOQUE_POR_ESTADO, bloquePorId, etiquetaCuenta } from '@/features/cuentas';
import { ESTADO_APROBADO, estadoLabel } from '@/features/cuentas';
import { normalizar } from '@/shared/utils';

/**
 * Carga laboral del usuario conectado.
 *
 * Cada cuenta trae sus pasos ordenados (la trazabilidad completa). Un paso es un movimiento:
 * `usuario` es quien lo ejecutó (quien entregó la cuenta) y `destinatario` a quien llegó (quien la
 * tiene en sus manos). Por eso, después de un paso la cuenta está en manos de su destinatario o, si
 * no lo trae, de quien lo ejecutó — la misma regla que usa el backend para el responsable actual.
 *
 * Un «tramo» es un periodo en que la cuenta estuvo en manos del usuario: desde que un paso se la
 * entregó hasta que el siguiente paso se la quitó. De ahí salen las dos preguntas del reporte:
 * quién me la entregó (el `usuario` del paso de entrada) y a quién se la pasé (el destinatario del
 * paso de salida), con las fechas y los días que estuvo conmigo.
 */

const DIA_MS = 86_400_000;

function fechaDe(value) {
  if (!value) return null;
  const texto = String(value).trim();
  if (!texto) return null;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(`${texto}T00:00:00`)
    : new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Quién tiene la cuenta justo después de este paso. */
function manosDe(paso) {
  const destino = paso?.destinatario?.trim();
  if (destino) return destino;
  return paso?.usuario?.trim() ?? '';
}

function coincide(nombre, claves) {
  const valor = normalizar(nombre);
  return Boolean(valor) && claves.includes(valor);
}

function pasosOrdenados(cuenta) {
  const pasos = Array.isArray(cuenta?.pasos) ? cuenta.pasos : [];
  return pasos
    .filter((paso) => paso && typeof paso.idEstado === 'number')
    .slice()
    .sort((a, b) => (fechaDe(a.fecha)?.getTime() ?? 0) - (fechaDe(b.fecha)?.getTime() ?? 0));
}

function tramosDeCuenta(cuenta, contrato, claves, hoy, incluirEnManos) {
  const pasos = pasosOrdenados(cuenta);
  const cerrada = cuenta?.idEstadoActual === ESTADO_APROBADO;
  const tramos = [];

  for (let i = 0; i < pasos.length; i += 1) {
    if (!coincide(manosDe(pasos[i]), claves)) continue;

    const desde = fechaDe(pasos[i].fecha);
    if (!desde) continue;

    // Primer paso posterior en que la cuenta ya no está en mis manos: ahí la entrego.
    let salida = null;
    for (let j = i + 1; j < pasos.length; j += 1) {
      if (!coincide(manosDe(pasos[j]), claves)) {
        salida = pasos[j];
        break;
      }
    }

    const enManos = salida === null && !cerrada;
    if (enManos && !incluirEnManos) continue;

    const hasta = salida ? fechaDe(salida.fecha) : enManos ? hoy : desde;
    const dias = hasta && hasta > desde ? (hasta.getTime() - desde.getTime()) / DIA_MS : 0;

    tramos.push({
      contrato: contrato?.noContrato ?? '—',
      contratista: contrato?.contratista ?? '—',
      cuenta: etiquetaCuenta(cuenta),
      idInformeActividad: cuenta?.idInformeActividad ?? null,
      bloque: BLOQUE_POR_ESTADO[pasos[i].idEstado] ?? null,
      estado: estadoLabel(pasos[i].idEstado, pasos[i].estado),
      recibidoDe: pasos[i].usuario?.trim() || '—',
      rolRecibidoDe: pasos[i].rolUsuario?.trim() || null,
      recibidoEl: pasos[i].fecha ?? null,
      entregadoA: salida ? (salida.destinatario?.trim() || salida.usuario?.trim() || '—') : '—',
      rolEntregadoA: salida ? (salida.rolDestinatario?.trim() || salida.rolUsuario?.trim() || null) : null,
      entregadoEl: salida ? (salida.fecha ?? null) : null,
      enManos,
      dias,
    });
  }

  return tramos;
}

function dentroRango(fecha, desde, hasta) {
  if (!desde && !hasta) return true;
  const valor = fechaDe(fecha);
  if (!valor) return true;
  if (desde && valor < desde) return false;
  if (hasta && valor > hasta) return false;
  return true;
}

/**
 * Construye la carga laboral. `usuario` es el nombre (o lista de nombres posibles) del conectado;
 * `filtros` acepta { desde, hasta, alcance: 'todas'|'curso'|'cerradas', texto, incluirEnManos }.
 * Devuelve los tramostramo a tramo y un resumen por cuenta, más los totales globales.
 */
export function buildCargaLaboral(contratos, usuario, filtros = {}, hoy = new Date()) {
  const claves = (Array.isArray(usuario) ? usuario : usuario ? [usuario] : [])
    .map((valor) => normalizar(valor))
    .filter(Boolean);

  const desde = filtros.desde ? fechaDe(filtros.desde) : null;
  // El rango de fechas es inclusivo por ambos lados: «hasta» cubre todo el día elegido.
  const hasta = filtros.hasta
    ? new Date(fechaDe(filtros.hasta).getTime() + DIA_MS - 1)
    : null;
  const alcance = filtros.alcance ?? 'todas';
  const texto = normalizar(filtros.texto ?? '');
  const incluirEnManos = filtros.incluirEnManos !== false;

  const movimientos = [];
  for (const contrato of contratos ?? []) {
    if (texto && !`${normalizar(contrato?.noContrato)} ${normalizar(contrato?.contratista)}`.includes(texto)) {
      continue;
    }
    for (const cuenta of contrato?.cuentasDetalle ?? []) {
      const cerrada = cuenta?.idEstadoActual === ESTADO_APROBADO;
      if (alcance === 'curso' && cerrada) continue;
      if (alcance === 'cerradas' && !cerrada) continue;
      for (const tramo of tramosDeCuenta(cuenta, contrato, claves, hoy, incluirEnManos)) {
        if (!dentroRango(tramo.recibidoEl, desde, hasta)) continue;
        movimientos.push(tramo);
      }
    }
  }

  // Primero en llegar, primero en verse: los movimientos salen ordenados por su fecha de entrada.
  movimientos.sort((a, b) =>
    String(a.recibidoEl ?? '9999').localeCompare(String(b.recibidoEl ?? '9999')),
  );

  const porCuenta = new Map();
  for (const tramo of movimientos) {
    const clave = `${tramo.contrato}||${tramo.idInformeActividad ?? tramo.cuenta}`;
    const acum = porCuenta.get(clave) ?? {
      contrato: tramo.contrato,
      contratista: tramo.contratista,
      cuenta: tramo.cuenta,
      movimientos: 0,
      dias: 0,
      primera: tramo.recibidoEl ?? null,
    };
    acum.movimientos += 1;
    acum.dias += tramo.dias;
    porCuenta.set(clave, acum);
  }

  const resumen = [...porCuenta.values()].map((item) => ({
    ...item,
    dias: Math.round(item.dias * 100) / 100,
    promedio: item.movimientos ? Math.round((item.dias / item.movimientos) * 100) / 100 : 0,
  })).sort((a, b) =>
    String(a.primera ?? '9999').localeCompare(String(b.primera ?? '9999')),
  );

  const totales = {
    usuario: Array.isArray(usuario) ? usuario[0] : usuario,
    movimientos: movimientos.length,
    cuentas: resumen.length,
    dias: Math.round(movimientos.reduce((sum, tramo) => sum + tramo.dias, 0) * 100) / 100,
    enManos: movimientos.filter((tramo) => tramo.enManos).length,
  };

  return { movimientos, resumen, totales };
}

export function nombreBloque(id) {
  const bloque = bloquePorId(id);
  return bloque ? `#${bloque.numero} ${bloque.nombre}` : '—';
}
