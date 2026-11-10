import { ESTADO_APROBADO } from '@/lib/estados';
import { NODOS } from '@/lib/flujoCuentaDiagrama';
import { CAJAS, FLECHAS, caminoDe, largoDe, rutaDeFlechas } from '@/lib/flujoFlechas';
import { trazarRuta } from '@/lib/flujoRutas';

/**
 * Estados del sistema anclados a la tarea del diagrama de referencia donde está la cuenta en ese
 * momento: 1 elabora el informe, 2 manda a revisión, 3 rechazado (devuelve al contratista),
 * 4 aprobado pendiente de firma, 5 cargue de la cuenta en SECOP II, 6-9-11-12 el informe de
 * supervisión y la RAS con firma digital, 13 enlace, 14 Jurídica, 15 MM, 16 FI, 17 el ordenador
 * firma el documento de pago, 18 recepción del oficio de CONDOR y 19 pago + cierre en SECOP II.
 * Los estados que devuelven la cuenta se pintan en rojo.
 */
export const NODO_POR_ESTADO = {
  1: ['elaboracion'],
  2: ['revision'],
  3: ['notificar-devolucion'],
  4: ['notificar-aprobado'],
  5: ['notificar-aprobado'],
  6: ['secop-cargue'],
  7: ['pantallazos'],
  8: [],
  9: ['informe-supervision'],
  10: ['notificar-devolucion'],
  11: ['informe-supervision'],
  12: ['informe-supervision'],
  13: ['enlace-revision'],
  14: ['juridica-firma'],
  15: ['mm-revision'],
  16: ['fi-revision'],
  17: ['ord2-firma'],
  18: ['tes-recepcion'],
  19: ['tes-pago', 'secop-cierre'],
};

export const ESTADOS_DEVUELTA = new Set([3, 8, 10]);

// Tramos como el rechazo caen en un ciclo largo del BPMN (vuelve al contratista y regresa): seguirlo
// dibujaría una vuelta de media página que no aporta nada, así que se corta con una línea directa.
const SALTOS_MAXIMOS = 8;

const esDevuelta = (id) => id === 'notificar-devolucion' || /-notificar-no$/.test(id ?? '');
const FLECHAS_DE_DEVOLUCION = new Set(
  FLECHAS.filter((f) => f.b && esDevuelta(f.b)).map((f) => f.i),
);

// La rama de rechazo solo se pinta cuando la cuenta sí fue devuelta. Si no, usarla de atajo para
// llegar a otra tarea dibujaría un rechazo que nunca ocurrió: en esos casos se prefiere el camino
// directo.
function atajoDeRechazo(ruta) {
  return ruta.flechas.slice(0, -1).some((f) => FLECHAS_DE_DEVOLUCION.has(f.i));
}

function desvioExcesivo(desde, hasta, largo) {
  const a = caja(desde);
  const b = caja(hasta);
  if (!a || !b) return true;
  const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
  const dy = (a.y + a.h / 2) - (b.y + b.h / 2);
  return largo > Math.hypot(dx, dy) * 4 + 900;
}

function caja(id) {
  const b = CAJAS.get(id);
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
}

// Solo las tareas del diagrama se tiñen al ser cruzadas; los rombos y los eventos siguen pintando
// el fondo para que la ruta no se confunda con el flujo completo.
const ES_TAREA = new Set(NODOS.map((n) => n.id));

const dentroDe = ([x, y], b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

// Cuándo (fracción del trazo) entra la línea por primera vez dentro de una caja. Las flechas del
// BPMN van siempre en ángulo recto, así que basta con el borde frontal de la caja.
function entradaEnSegmento(x0, y0, x1, y1, b) {
  const derecha = b.x + b.w;
  const abajo = b.y + b.h;
  if (x0 === x1) {
    if (x0 < b.x || x0 > derecha || y1 === y0) return null;
    const meta = y1 > y0 ? b.y : abajo;
    const t = (meta - y0) / (y1 - y0);
    return t > 0 && t <= 1 ? t : null;
  }
  if (y0 === y1) {
    if (y0 < b.y || y0 > abajo || x1 === x0) return null;
    const meta = x1 > x0 ? b.x : derecha;
    const t = (meta - x0) / (x1 - x0);
    return t > 0 && t <= 1 ? t : null;
  }
  return null;
}

function fraccionDeEntrada(puntos, b) {
  const total = largoDe(puntos);
  if (total <= 0) return null;
  let andado = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    const [x0, y0] = puntos[i - 1];
    const [x1, y1] = puntos[i];
    if (dentroDe(puntos[i - 1], b)) return andado / total;
    const t = entradaEnSegmento(x0, y0, x1, y1, b);
    if (t !== null) return (andado + t * Math.hypot(x1 - x0, y1 - y0)) / total;
    andado += Math.hypot(x1 - x0, y1 - y0);
  }
  return null;
}

// Tareas que la punta del trazo va encendiendo mientras dibuja esa flecha, en el orden en que las
// toca. La caja de destino se incluye aunque la punta termine justo en su borde.
function contactos(puntos, destino) {
  const lista = [];
  for (const id of ES_TAREA) {
    const b = caja(id);
    if (!b) continue;
    const f = fraccionDeEntrada(puntos, b);
    if (f !== null) lista.push({ id, f });
  }
  if (destino && ES_TAREA.has(destino) && !lista.some((s) => s.id === destino)) {
    lista.push({ id: destino, f: 1 });
  }
  lista.sort((a, b) => a.f - b.f);
  return lista;
}

/**
 * Recorrido pintable de una cuenta: qué tareas tocó, en qué orden, con qué tono y por dónde va la
 * línea entre una y otra.
 */
export function pintarRecorrido(pasos = [], enTramite = true) {
  const limpios = pasos.filter((p) => p && p.idEstado !== null && p.idEstado !== undefined);
  const visitas = [];

  for (const paso of limpios) {
    for (const id of NODO_POR_ESTADO[paso.idEstado] ?? []) {
      if (!caja(id)) continue;
      const previa = visitas[visitas.length - 1];
      if (previa && previa.nodoId === id) {
        previa.paso = paso;
        continue;
      }
      visitas.push({ nodoId: id, paso });
    }
  }

  if (visitas.length === 0) {
    return { pasos: [], tramos: [], nodos: new Map(), cruzados: new Map(), bbox: null, devuelta: false, cerrado: false, gestiones: limpios.length };
  }

  const ultimoEstado = limpios.length > 0 ? limpios[limpios.length - 1].idEstado : null;
  const cerrado = ultimoEstado === ESTADO_APROBADO;
  const nodos = new Map();
  let devuelta = false;

  visitas.forEach((visita, indice) => {
    const esUltima = indice === visitas.length - 1;
    const vuelve = ESTADOS_DEVUELTA.has(visita.paso.idEstado);
    if (vuelve) devuelta = true;

    let tono = 'hecho';
    if (vuelve) tono = 'devuelta';
    else if (esUltima) tono = enTramite && !cerrado ? 'actual' : 'final';

    visita.indice = indice;
    visita.tono = tono;

    const previo = nodos.get(visita.nodoId);
    if (!previo) {
      nodos.set(visita.nodoId, { tono, indice, paso: visita.paso });
    } else if (esUltima) {
      nodos.set(visita.nodoId, { ...previo, tono, paso: visita.paso });
    } else if (vuelve && previo.tono !== 'devuelta') {
      nodos.set(visita.nodoId, { ...previo, tono, paso: visita.paso });
    }
  });

  // Un nodo puede visitarse varias veces (p. ej. la revisión después de una devolución): la
  // insignia muestra todos los números del recorrido para que no queden huecos en la numeración.
  const visitasPorNodo = new Map();
  visitas.forEach((visita, indice) => {
    if (!visitasPorNodo.has(visita.nodoId)) visitasPorNodo.set(visita.nodoId, []);
    visitasPorNodo.get(visita.nodoId).push(indice);
  });
  for (const [id, nodo] of nodos) nodos.set(id, { ...nodo, visitas: visitasPorNodo.get(id) ?? [nodo.indice] });

  const uso = new Map();
  const tramos = [];
  const puntosTodos = [];
  // Tareas por las que la línea pasa de camino (repaso en SAP, notificaciones internas): no son
  // gestiones registradas, así que no llevan insignia, pero sí se pintan: la cuenta las tocó.
  const cruzados = new Map();
  const marcarCruzada = (id, indice, tono) => {
    if (!id || cruzados.has(id) || nodos.has(id) || !ES_TAREA.has(id)) return;
    cruzados.set(id, { indice, tono: tono === 'actual' ? 'hecho' : tono });
  };

  for (let indice = 1; indice < visitas.length; indice += 1) {
    const tono = visitas[indice].tono === 'final' ? 'hecho' : visitas[indice].tono;
    const ruta = rutaDeFlechas(visitas[indice - 1].nodoId, visitas[indice].nodoId, uso);
    // Volver a una parada ya recorrida es una devolución: seguir el ciclo del BPMN repetiría el
    // mismo tramo de ida y vuelta, así que se une con una línea directa.
    const reincide = visitas.slice(0, indice).some((v) => v.nodoId === visitas[indice].nodoId);
    if (
      ruta
      && ruta.flechas.length > 0
      && !atajoDeRechazo(ruta)
      && ruta.flechas.length <= (reincide ? 3 : SALTOS_MAXIMOS)
      && !desvioExcesivo(visitas[indice - 1].nodoId, visitas[indice].nodoId, ruta.largo)
    ) {
      for (const flecha of ruta.flechas) {
        marcarCruzada(flecha.a, indice, tono);
        marcarCruzada(flecha.b, indice, tono);
        tramos.push({
          paso: indice,
          flecha: flecha.i,
          d: caminoDe(flecha.puntos),
          puntos: flecha.puntos,
          largo: flecha.largo,
          tono,
          toca: contactos(flecha.puntos, flecha.b),
        });
        uso.set(flecha.i, (uso.get(flecha.i) ?? 0) + 1);
        puntosTodos.push(...flecha.puntos);
      }
      continue;
    }
    // Hay gestiones sin flecha que las una (p. ej. "Cambiar a estado pagado") y otras que solo se
    // alcanzan dando una vuelta larga: para esas se traza un camino en ángulo recto, sin imitar la
    // topología del proceso.
    const desvio = trazarRuta(visitas[indice - 1].nodoId, visitas[indice].nodoId, new Map());
    if (!desvio) continue;
    tramos.push({
      paso: indice,
      flecha: `libre-${indice}`,
      ...desvio,
      tono,
      toca: contactos(desvio.puntos, visitas[indice].nodoId),
    });
    puntosTodos.push(...desvio.puntos);
  }

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const visita of visitas) {
    const b = caja(visita.nodoId);
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  for (const p of puntosTodos) {
    x1 = Math.min(x1, p[0]);
    y1 = Math.min(y1, p[1]);
    x2 = Math.max(x2, p[0]);
    y2 = Math.max(y2, p[1]);
  }

  return {
    pasos: visitas,
    tramos,
    nodos,
    cruzados,
    bbox: { x: x1 - 26, y: y1 - 26, w: x2 - x1 + 52, h: y2 - y1 + 52 },
    devuelta,
    cerrado,
    gestiones: limpios.length,
  };
}
