import { ESTADO_APROBADO, ESTADO_DEVOLUCION, ESTADOS_RECHAZO, estadoLabel } from '@/lib/estados';

/**
 * Los ocho bloques funcionales por los que pasa una cuenta de cobro y cómo se
 * clasifica cada cuenta para el mapa de visión en vivo.
 *
 * La clasificación sale del estado actual de la cuenta:
 *  - estados 1 a 18 que no son devolución -> el bloque de quien tiene que actuar hoy;
 *  - estados 3, 8 y 10 (rechazo / informe devuelto) -> el bloque que RETOMA la cuenta,
 *    que es distinto del que la devolvió: el BPMN devuelve al Supervisor (Enlace,
 *    Jurídica, MM y Ordenador), de Tesorería vuelve al Enlace y de FI a MM;
 *  - estado 0 (sin inicio) y 19 (pago + cierre en SECOP II) -> no se muestran:
 *    el mapa solo habla de cuentas que ya arrancaron y todavía no cerraron.
 */
export const BLOQUES = [
  { id: 'contratista', numero: 1, nombre: 'Contratista', actividad: 'Radicación / Ajustes' },
  { id: 'supervisor', numero: 2, nombre: 'Supervisor', actividad: 'Revisión Técnica' },
  { id: 'enlace', numero: 3, nombre: 'Enlace', actividad: 'Control Documental' },
  { id: 'juridica', numero: 4, nombre: 'Área Jurídica', actividad: 'Pólizas y Visto Bueno' },
  { id: 'mm', numero: 5, nombre: 'Usuario MM', actividad: 'Gestión de Materiales' },
  { id: 'ordenador', numero: 6, nombre: 'Ordenador', actividad: 'Autorización y Firma' },
  { id: 'fi', numero: 7, nombre: 'Usuario FI', actividad: 'Finanzas' },
  { id: 'tesoreria', numero: 8, nombre: 'Tesorería', actividad: 'Desembolso y Giro' },
];

/** Estado del trámite -> bloque que lo tiene hoy. Los no listados quedan fuera del mapa. */
export const BLOQUE_POR_ESTADO = {
  1: 'contratista', // Registrando
  2: 'supervisor', // En revisión
  4: 'supervisor', // Aprobado pendiente firma
  5: 'supervisor', // Aprobado pendiente firma y SECOP
  6: 'contratista', // Pendiente SECOP
  7: 'contratista', // En revisión SECOP
  9: 'supervisor', // Aprobado
  11: 'supervisor', // Supervisión registrada
  12: 'supervisor', // RAS registrado
  13: 'enlace', // Enviado a enlace
  14: 'juridica', // Enviado a abogado
  15: 'mm', // Enviado a usuario MM
  16: 'fi', // Enviado a usuario FI
  17: 'ordenador', // Enviado a ordenador
  18: 'tesoreria', // Enviado a tesorería
};

/** Estados que dejan la cuenta devuelta: rechazos e informe devuelto. */
export const ESTADOS_DEVOLUCION = new Set([...ESTADOS_RECHAZO, ESTADO_DEVOLUCION]);

/** Bloque al que vuelve la cuenta según el rol que la devolvió (reglas del BPMN). */
const RETOMA_POR_ORIGEN = {
  13: 'supervisor', // Enlace devuelve -> la revisa el Supervisor
  14: 'supervisor', // Área Jurídica
  15: 'supervisor', // Usuario MM
  17: 'supervisor', // Ordenador del Gasto
  16: 'mm', // Usuario FI devuelve -> vuelve a MM
  18: 'enlace', // Tesorería devuelve -> vuelve al Enlace
};
// Todo lo demás (Supervisor, SECOP II o sin historial) lo retoma el Contratista.

/** Nombre del rol que produjo un estado: se usa en la tarjeta de devolución. */
const ROL_POR_ESTADO = {
  1: 'Contratista',
  2: 'Supervisor',
  4: 'Supervisor',
  5: 'Supervisor',
  6: 'SECOP II',
  7: 'SECOP II',
  9: 'Supervisor',
  11: 'Supervisor',
  12: 'Supervisor',
  13: 'Enlace',
  14: 'Área Jurídica',
  15: 'Usuario MM',
  16: 'Usuario FI',
  17: 'Ordenador del Gasto',
  18: 'Tesorería',
};

/** Bloque al que vuelve una cuenta caída en devolución/rechazo según el estado de origen. */
export function bloqueDevolucion(origen) {
  return RETOMA_POR_ORIGEN[origen] ?? 'contratista';
}

const BLOQUES_POR_ID = new Map(BLOQUES.map((bloque) => [bloque.id, bloque]));

function pasosDe(cuenta) {
  const pasos = Array.isArray(cuenta?.pasos) ? cuenta.pasos : [];
  return pasos.filter((paso) => paso && typeof paso.idEstado === 'number');
}

/**
 * Estado desde el que la cuenta cayó en devolución: de ahí sale quién la devolvió.
 * El último paso es el estado actual, así que se busca hacia atrás el distinto.
 */
function origenDeDevolucion(cuenta) {
  const pasos = pasosDe(cuenta);
  for (let i = pasos.length - 1; i >= 0; i -= 1) {
    if (pasos[i].idEstado !== cuenta.idEstadoActual) {
      return pasos[i].idEstado;
    }
  }
  return null;
}

/**
 * Clasifica una cuenta: null si no entra al mapa (sin inicio o ya cerrada),
 * o { modo: 'curso' | 'devolucion', bloque, origen }.
 */
export function clasificarCuenta(cuenta) {
  const id = cuenta?.idEstadoActual;
  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (id === 0 || id === ESTADO_APROBADO) return null;
  if (ESTADOS_DEVOLUCION.has(id)) {
    const origen = origenDeDevolucion(cuenta);
    return { modo: 'devolucion', bloque: RETOMA_POR_ORIGEN[origen] ?? 'contratista', origen };
  }
  const bloque = BLOQUE_POR_ESTADO[id];
  return bloque ? { modo: 'curso', bloque, origen: null } : null;
}

/** Conteo por bloque de toda la lista de contratos: una sola pasada, sin armar listas. */
export function conteoDeBloques(contratos) {
  const conteo = new Map(BLOQUES.map((bloque) => [bloque.id, { curso: 0, devolucion: 0 }]));
  const totales = { enCurso: 0, devolucion: 0 };
  for (const contrato of contratos ?? []) {
    for (const cuenta of contrato?.cuentasDetalle ?? []) {
      const clase = clasificarCuenta(cuenta);
      if (!clase) continue;
      const contador = conteo.get(clase.bloque);
      if (!contador) continue;
      if (clase.modo === 'curso') {
        contador.curso += 1;
        totales.enCurso += 1;
      } else {
        contador.devolucion += 1;
        totales.devolucion += 1;
      }
    }
  }
  return { conteo, totales };
}

/** Las cuentas de un solo bloque, con su contrato a mano para pintar la tarjeta. */
export function cuentasDeBloque(contratos, bloqueId) {
  const listas = { curso: [], devolucion: [] };
  for (const contrato of contratos ?? []) {
    for (const cuenta of contrato?.cuentasDetalle ?? []) {
      const clase = clasificarCuenta(cuenta);
      if (!clase || clase.bloque !== bloqueId) continue;
      const destino = clase.modo === 'curso' ? listas.curso : listas.devolucion;
      destino.push({ contrato, cuenta, clase });
    }
  }
  // Quien lleva más tiempo en el bloque va primero: es el que más tarda en moverse.
  const porAntiguedad = (a, b) =>
    String(a.cuenta.fechaEstado ?? '9999').localeCompare(String(b.cuenta.fechaEstado ?? '9999'));
  listas.curso.sort(porAntiguedad);
  listas.devolucion.sort(porAntiguedad);
  return listas;
}

/** Etiqueta visible de la cuenta, igual que en el detalle del contrato. */
export function etiquetaCuenta(cuenta) {
  return cuenta?.noInforme !== null && cuenta?.noInforme !== undefined
    ? `Cuenta N.° ${cuenta.noInforme}`
    : `Informe ${cuenta?.idInformeActividad ?? ''}`;
}

/** Rol que produjo el estado, para decir quién devolvió la cuenta. */
export function rolDeEstado(idEstado) {
  return idEstado === null || idEstado === undefined ? null : ROL_POR_ESTADO[idEstado] ?? null;
}

export function bloquePorId(id) {
  return BLOQUES_POR_ID.get(id) ?? null;
}

/** El bloque con más cuentas: con eso arranca la vista si el usuario todavía no eligió. */
export function bloquePrincipal(conteo) {
  let mejor = null;
  let mayor = -1;
  for (const bloque of BLOQUES) {
    const datos = conteo.get(bloque.id);
    const total = datos ? datos.curso + datos.devolucion : 0;
    if (total > mayor) {
      mayor = total;
      mejor = bloque.id;
    }
  }
  return mejor ?? BLOQUES[0].id;
}

/** Nombre del estado para tarjetas, sin repetir la lógica de etiquetas. */
export function nombreEstado(cuenta) {
  return estadoLabel(cuenta?.idEstadoActual, cuenta?.estadoActual);
}
