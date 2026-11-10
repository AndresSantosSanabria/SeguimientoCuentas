import { COMPUERTAS, CONECTORES, EVENTOS, NODOS } from '@/lib/flujoCuentaDiagrama';

/**
 * Grafo de las flechas publicadas del proceso. El recorrido de una cuenta no se inventa un camino:
 * avanza por estas flechas, así que lo que se pinta es exactamente la ruta del flujo.
 *
 * El diagrama se dibuja completo: las cajas "Notificar" existen en el BPMN de referencia, así que
 * no se oculta ninguna. El set se mantiene vacío y accesible porque el recorrido y el lienzo
 * pregunten por él igual.
 */
export const OCULTOS = new Set();

export const CAJAS = new Map();
NODOS.forEach((n) => CAJAS.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h }));
COMPUERTAS.forEach((c) => CAJAS.set(c.id, { x: c.x, y: c.y, w: 36, h: 36 }));
EVENTOS.forEach((e, i) => CAJAS.set(`evento-${e.tipo}-${i}`, { x: e.x, y: e.y, w: 25, h: 25 }));

const TOLERANCIA = 10;
const TOLERANCIA_LEJOS = 42;

function distanciaACaja(px, py, b) {
  const dx = Math.max(b.x - px, px - (b.x + b.w), 0);
  const dy = Math.max(b.y - py, py - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}

function cajaMasCerca(px, py, margen) {
  let mejor = null;
  for (const [id, b] of CAJAS) {
    const d = distanciaACaja(px, py, b);
    if (d <= margen && (!mejor || d < mejor.d)) mejor = { id, d };
  }
  return mejor;
}

export function puntosDe(d) {
  const puntos = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, a, b] of d.matchAll(/([MHV])\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g)) {
    if (cmd === 'M') {
      x = Number(a);
      y = Number(b);
    } else if (cmd === 'H') x = Number(a);
    else y = Number(a);
    const [ux, uy] = puntos[puntos.length - 1] ?? [];
    if (ux !== x || uy !== y) puntos.push([x, y]);
  }
  return puntos;
}

export const caminoDe = (puntos) => {
  if (puntos.length < 2) return '';
  const trozos = [`M${puntos[0][0]} ${puntos[0][1]}`];
  for (let i = 1; i < puntos.length; i += 1) {
    trozos.push(`L${puntos[i][0]} ${puntos[i][1]}`);
  }
  return trozos.join(' ');
};

export const largoDe = (puntos) => {
  let largo = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    largo += Math.abs(puntos[i][0] - puntos[i - 1][0]) + Math.abs(puntos[i][1] - puntos[i - 1][1]);
  }
  return largo;
};

/** Cada flecha publicada, con la caja de la que sale y a la que llega. */
export const FLECHAS = CONECTORES.map((c, i) => {
  const puntos = puntosDe(c.d);
  const [x0, y0] = puntos[0];
  const [x1, y1] = puntos[puntos.length - 1];
  const a = cajaMasCerca(x0, y0, TOLERANCIA)?.id ?? cajaMasCerca(x0, y0, TOLERANCIA_LEJOS)?.id ?? null;
  const b = cajaMasCerca(x1, y1, TOLERANCIA)?.id ?? cajaMasCerca(x1, y1, TOLERANCIA_LEJOS)?.id ?? null;
  return { i, grupo: c.grupo, d: c.d, puntos, a, b, largo: largoDe(puntos) };
});

const VECINOS = new Map();
for (const f of FLECHAS) {
  if (!f.a || !f.b || f.a === f.b) continue;
  if (!VECINOS.has(f.a)) VECINOS.set(f.a, []);
  VECINOS.get(f.a).push({ id: f.b, flecha: f });
}

function monticulo() {
  const datos = [];
  const subir = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (datos[p].costo <= datos[i].costo) break;
      [datos[p], datos[i]] = [datos[i], datos[p]];
      i = p;
    }
  };
  const bajar = (i) => {
    for (;;) {
      const izq = i * 2 + 1;
      const der = izq + 1;
      let menor = i;
      if (izq < datos.length && datos[izq].costo < datos[menor].costo) menor = izq;
      if (der < datos.length && datos[der].costo < datos[menor].costo) menor = der;
      if (menor === i) break;
      [datos[menor], datos[i]] = [datos[i], datos[menor]];
      i = menor;
    }
  };
  return {
    get vacio() {
      return datos.length === 0;
    },
    meter(nodo, costo) {
      datos.push({ nodo, costo });
      subir(datos.length - 1);
    },
    sacar() {
      const primero = datos[0];
      const ultimo = datos.pop();
      if (datos.length > 0) {
        datos[0] = ultimo;
        bajar(0);
      }
      return primero;
    },
  };
}

/**
 * Ruta del flujo entre dos cajas: la lista de flechas que hay que recorrer, ya orientadas en el
 * sentido en que se camina.
 */
export function rutaDeFlechas(desde, hasta, uso = new Map()) {
  if (!CAJAS.has(desde) || !CAJAS.has(hasta)) return null;
  if (desde === hasta) return { flechas: [], largo: 0, puntos: [] };

  const cola = monticulo();
  const costo = new Map([[desde, 0]]);
  const previo = new Map();
  cola.meter(desde, 0);

  while (!cola.vacio) {
    const { nodo, costo: actual } = cola.sacar();
    if (nodo === hasta) break;
    if (actual > (costo.get(nodo) ?? Number.POSITIVE_INFINITY)) continue;
    for (const { id, flecha } of VECINOS.get(nodo) ?? []) {
      // Reusar una flecha ya pintada por otra gestión se penaliza para que el trazo no se encime.
      const tramo = flecha.largo + (uso.get(flecha.i) ?? 0) * 26;
      const nuevo = actual + tramo;
      if (nuevo < (costo.get(id) ?? Number.POSITIVE_INFINITY)) {
        costo.set(id, nuevo);
        previo.set(id, { de: nodo, flecha });
        cola.meter(id, nuevo);
      }
    }
  }

  if (!previo.has(hasta)) return null;

  const flechas = [];
  let nodo = hasta;
  while (previo.has(nodo)) {
    const paso = previo.get(nodo);
    flechas.unshift({ ...paso.flecha, desde: paso.de, hacia: nodo });
    nodo = paso.de;
  }

  const puntos = [];
  for (const flecha of flechas) {
    for (const p of flecha.puntos) {
      const [ux, uy] = puntos[puntos.length - 1] ?? [];
      if (ux !== p[0] || uy !== p[1]) puntos.push(p);
    }
  }

  return { flechas, largo: largoDe(puntos), puntos };
}
