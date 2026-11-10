import { ANCHO, ALTO, CHARCO_BAJO, CHARCOS, COMPUERTAS, EVENTOS, NODOS } from '@/lib/flujoCuentaDiagrama';

/**
 * Ruteo ortogonal del recorrido sobre el diagrama.
 *
 * Las flechas que exporta Bizagi cruzan por encima de las cajas, así que el recorrido no se dibuja
 * con esos conectores: se calcula un camino propio, en ángulo recto y esquivando los nodos, sobre
 * una rejilla con las coordenadas relevantes del plano (bordes y centros de cada caja).
 */

const MARGEN = 6;
const COSTO_GIRO = 40;
const COSTO_REUSO = 26;
const RADIO = 9;
const DESPEJE = 18;

export const CAJAS = new Map();
NODOS.forEach((n) => CAJAS.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h }));
COMPUERTAS.forEach((c) => CAJAS.set(c.id, { x: c.x, y: c.y, w: 36, h: 36 }));
EVENTOS.forEach((e, i) => CAJAS.set(`evento-${e.tipo}-${i}`, { x: e.x, y: e.y, w: 25, h: 25 }));

const OBSTACULOS = [...CAJAS.entries()].map(([id, b]) => ({
  id,
  x1: b.x - MARGEN,
  y1: b.y - MARGEN,
  x2: b.x + b.w + MARGEN,
  y2: b.y + b.h + MARGEN,
}));

const REALES = [...CAJAS.entries()].map(([id, b]) => ({ id, x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h }));

const lineas = (valores) => [...new Set(valores.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);

const XS = lineas([
  13,
  58,
  ...CHARCOS.map((c) => c.hasta),
  ANCHO - 20,
  ...OBSTACULOS.flatMap((o) => [o.x1, o.x2]),
  ...[...CAJAS.values()].map((b) => b.x + b.w / 2),
]);
const YS = lineas([
  13,
  CHARCO_BAJO,
  ALTO - 13,
  ...OBSTACULOS.flatMap((o) => [o.y1, o.y2]),
  ...[...CAJAS.values()].map((b) => b.y + b.h / 2),
]);

const ANCHO_REJILLA = XS.length;
const ALTO_REJILLA = YS.length;

const cruza = (a, b) => a > b ? [b, a] : [a, b];

const BLOQUEO_H = new Uint8Array(ANCHO_REJILLA * ALTO_REJILLA);
const BLOQUEO_V = new Uint8Array(ANCHO_REJILLA * ALTO_REJILLA);

for (let j = 0; j < ALTO_REJILLA; j += 1) {
  for (let i = 0; i < ANCHO_REJILLA - 1; i += 1) {
    const [desde, hasta] = cruza(XS[i], XS[i + 1]);
    const y = YS[j];
    const choca = OBSTACULOS.some((o) => o.y1 + 0.5 < y && y < o.y2 - 0.5 && o.x1 < hasta - 0.5 && o.x2 > desde + 0.5);
    BLOQUEO_H[j * ANCHO_REJILLA + i] = choca ? 1 : 0;
  }
}

for (let i = 0; i < ANCHO_REJILLA; i += 1) {
  for (let j = 0; j < ALTO_REJILLA - 1; j += 1) {
    const [desde, hasta] = cruza(YS[j], YS[j + 1]);
    const x = XS[i];
    const choca = OBSTACULOS.some((o) => o.x1 + 0.5 < x && x < o.x2 - 0.5 && o.y1 < hasta - 0.5 && o.y2 > desde + 0.5);
    BLOQUEO_V[j * ANCHO_REJILLA + i] = choca ? 1 : 0;
  }
}

const masCercano = (valores, v) => {
  let mejor = 0;
  for (let k = 1; k < valores.length; k += 1) {
    if (Math.abs(valores[k] - v) < Math.abs(valores[mejor] - v)) mejor = k;
  }
  return mejor;
};

const celdaLibre = (i, j) => {
  for (let radio = 0; radio < 8; radio += 1) {
    for (let di = -radio; di <= radio; di += 1) {
      for (let dj = -radio; dj <= radio; dj += 1) {
        if (Math.abs(di) !== radio && Math.abs(dj) !== radio) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= ANCHO_REJILLA || nj >= ALTO_REJILLA) continue;
        const dentro = OBSTACULOS.some(
          (o) => o.x1 + 0.5 < XS[ni] && XS[ni] < o.x2 - 0.5 && o.y1 + 0.5 < YS[nj] && YS[nj] < o.y2 - 0.5,
        );
        if (!dentro) return [ni, nj];
      }
    }
  }
  return [i, j];
};

function lados(a, b) {
  const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
  const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
  if (Math.abs(dx) > Math.abs(dy) * 1.05) return dx > 0 ? ['derecha', 'izquierda'] : ['izquierda', 'derecha'];
  return dy > 0 ? ['abajo', 'arriba'] : ['arriba', 'abajo'];
}

function borde(b, lado, extra) {
  switch (lado) {
    case 'derecha': return [b.x + b.w + extra, b.y + b.h / 2];
    case 'izquierda': return [b.x - extra, b.y + b.h / 2];
    case 'abajo': return [b.x + b.w / 2, b.y + b.h + extra];
    default: return [b.x + b.w / 2, b.y - extra];
  }
}

const OPUESTO = { derecha: 'izquierda', izquierda: 'derecha', abajo: 'arriba', arriba: 'abajo' };

/** El codo de salida no puede atravesar la caja vecina que esté pegada al nodo. */
function codoLibre(b, lado) {
  const [x1, y1] = borde(b, lado, 0);
  const [x2, y2] = borde(b, lado, DESPEJE);
  return !REALES.some(
    (o) => o.id !== b.id
      && Math.min(x1, x2) < o.x2 - 0.5
      && Math.max(x1, x2) > o.x1 + 0.5
      && Math.min(y1, y2) < o.y2 - 0.5
      && Math.max(y1, y2) > o.y1 + 0.5,
  );
}

function elegirLado(b, preferido, hacia) {
  const laterales = preferido === 'abajo' || preferido === 'arriba'
    ? (hacia.x < b.x + b.w / 2 ? ['izquierda', 'derecha'] : ['derecha', 'izquierda'])
    : (hacia.y < b.y + b.h / 2 ? ['arriba', 'abajo'] : ['abajo', 'arriba']);
  for (const lado of [...new Set([preferido, ...laterales, OPUESTO[preferido]])]) {
    if (codoLibre(b, lado)) return lado;
  }
  return preferido;
}

class Monticulo {
  constructor() { this.items = []; }

  get vacio() { return this.items.length === 0; }

  push(f, id) {
    const items = this.items;
    items.push({ f, id });
    let k = items.length - 1;
    while (k > 0) {
      const padre = (k - 1) >> 1;
      if (items[padre].f <= items[k].f) break;
      [items[padre], items[k]] = [items[k], items[padre]];
      k = padre;
    }
  }

  pop() {
    const items = this.items;
    const cima = items[0];
    const ultimo = items.pop();
    if (items.length > 0) {
      items[0] = ultimo;
      let k = 0;
      for (;;) {
        const izq = k * 2 + 1;
        const der = izq + 1;
        let menor = k;
        if (izq < items.length && items[izq].f < items[menor].f) menor = izq;
        if (der < items.length && items[der].f < items[menor].f) menor = der;
        if (menor === k) break;
        [items[menor], items[k]] = [items[k], items[menor]];
        k = menor;
      }
    }
    return cima.id;
  }
}

function buscar(inicio, fin, uso) {
  const [i0, j0, dir0] = inicio;
  const [i1, j1] = fin;
  const total = ANCHO_REJILLA * ALTO_REJILLA * 4;
  const costo = new Float64Array(total).fill(Infinity);
  const previo = new Int32Array(total).fill(-1);
  const cerrado = new Uint8Array(total);
  const metaI = i1;
  const metaJ = j1;
  const heuristica = (i, j) => Math.abs(XS[i] - XS[metaI]) + Math.abs(YS[j] - YS[metaJ]);
  const clave = (i, j, d) => ((j * ANCHO_REJILLA + i) * 4) + d;

  const inicioClave = clave(i0, j0, dir0);
  costo[inicioClave] = 0;
  const monticulo = new Monticulo();
  monticulo.push(heuristica(i0, j0), inicioClave);
  let llegada = -1;

  while (!monticulo.vacio) {
    const actual = monticulo.pop();
    if (cerrado[actual]) continue;
    cerrado[actual] = 1;
    const dir = actual % 4;
    const celda = (actual - dir) / 4;
    const i = celda % ANCHO_REJILLA;
    const j = (celda - i) / ANCHO_REJILLA;
    if (i === metaI && j === metaJ) { llegada = actual; break; }

    const vecinos = [];
    if (i + 1 < ANCHO_REJILLA && !BLOQUEO_H[j * ANCHO_REJILLA + i]) vecinos.push([i + 1, j, 0]);
    if (i - 1 >= 0 && !BLOQUEO_H[j * ANCHO_REJILLA + i - 1]) vecinos.push([i - 1, j, 1]);
    if (j + 1 < ALTO_REJILLA && !BLOQUEO_V[j * ANCHO_REJILLA + i]) vecinos.push([i, j + 1, 2]);
    if (j - 1 >= 0 && !BLOQUEO_V[(j - 1) * ANCHO_REJILLA + i]) vecinos.push([i, j - 1, 3]);

    for (const [ni, nj, ndir] of vecinos) {
      const siguiente = clave(ni, nj, ndir);
      if (cerrado[siguiente]) continue;
      const largo = Math.abs(XS[ni] - XS[i]) + Math.abs(YS[nj] - YS[j]);
      const reuso = uso?.get(`${Math.min(celda, (nj * ANCHO_REJILLA + ni))}:${Math.max(celda, (nj * ANCHO_REJILLA + ni))}`) ?? 0;
      const propuesto = costo[actual] + largo + (dir === ndir ? 0 : COSTO_GIRO) + reuso * COSTO_REUSO;
      if (propuesto < costo[siguiente]) {
        costo[siguiente] = propuesto;
        previo[siguiente] = actual;
        monticulo.push(propuesto + heuristica(ni, nj), siguiente);
      }
    }
  }

  if (llegada < 0) return [];

  const celdas = [];
  let actual = llegada;
  while (actual >= 0) {
    const dir = actual % 4;
    const celda = (actual - dir) / 4;
    const i = celda % ANCHO_REJILLA;
    const j = (celda - i) / ANCHO_REJILLA;
    celdas.push([i, j]);
    if (actual === inicioClave) break;
    actual = previo[actual];
  }
  celdas.reverse();
  return celdas;
}

function recta(puntos) {
  const salida = [];
  for (const p of puntos) {
    const n = salida.length;
    if (n > 0 && Math.abs(salida[n - 1][0] - p[0]) < 0.5 && Math.abs(salida[n - 1][1] - p[1]) < 0.5) continue;
    if (n > 1) {
      const a = salida[n - 2];
      const b = salida[n - 1];
      const mismoX = Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - p[0]) < 0.5;
      const mismoY = Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - p[1]) < 0.5;
      if (mismoX || mismoY) { salida[n - 1] = p; continue; }
    }
    salida.push(p);
  }
  return salida;
}

const vertical = (lado) => lado === 'abajo' || lado === 'arriba';

/** Garantiza que el trazo no tenga diagonales: intercala el codo que falte. */
function alinear(puntos, salida, entrada) {
  const fin = [];
  for (let k = 0; k < puntos.length; k += 1) {
    if (k === 0) { fin.push(puntos[k]); continue; }
    const previo = fin[fin.length - 1];
    const actual = puntos[k];
    if (Math.abs(previo[0] - actual[0]) > 0.5 && Math.abs(previo[1] - actual[1]) > 0.5) {
      const ejeVertical = k === 1
        ? vertical(salida)
        : k === puntos.length - 1
          ? vertical(entrada)
          : Math.abs(fin[Math.max(0, fin.length - 2)][0] - previo[0]) < 0.5;
      fin.push(ejeVertical ? [previo[0], actual[1]] : [actual[0], previo[1]]);
    }
    fin.push(actual);
  }
  return fin;
}

const punto = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`;

function redondear(puntos) {
  if (puntos.length < 2) return '';
  let d = `M ${punto(puntos[0])}`;
  for (let k = 1; k < puntos.length - 1; k += 1) {
    const a = puntos[k - 1];
    const b = puntos[k];
    const c = puntos[k + 1];
    const v1x = a[0] - b[0];
    const v1y = a[1] - b[1];
    const v2x = c[0] - b[0];
    const v2y = c[1] - b[1];
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 < 0.5 || l2 < 0.5) continue;
    const r = Math.min(RADIO, l1 / 2, l2 / 2);
    const p1 = [b[0] + (v1x / l1) * r, b[1] + (v1y / l1) * r];
    const p2 = [b[0] + (v2x / l2) * r, b[1] + (v2y / l2) * r];
    d += ` L ${punto(p1)} Q ${punto(b)} ${punto(p2)}`;
  }
  d += ` L ${punto(puntos[puntos.length - 1])}`;
  return d;
}

export function largoDe(puntos) {
  let total = 0;
  for (let k = 1; k < puntos.length; k += 1) {
    total += Math.abs(puntos[k][0] - puntos[k - 1][0]) + Math.abs(puntos[k][1] - puntos[k - 1][1]);
  }
  return total;
}

/** Camino en ángulo recto entre dos cajas, esquivando las demás. */
export function trazarRuta(desdeId, hastaId, uso = new Map()) {
  const a = CAJAS.get(desdeId);
  const b = CAJAS.get(hastaId);
  if (!a || !b) return null;

  const [salidaPreferida, entradaPreferida] = lados(a, b);
  const centroA = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const centroB = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const salida = elegirLado(a, salidaPreferida, centroB);
  const entrada = elegirLado(b, entradaPreferida, centroA);
  const origen = borde(a, salida, 0);
  const destino = borde(b, entrada, 0);
  const arranque = borde(a, salida, MARGEN);
  const cierre = borde(b, entrada, MARGEN);

  const [i0, j0] = celdaLibre(masCercano(XS, arranque[0]), masCercano(YS, arranque[1]));
  const [i1, j1] = celdaLibre(masCercano(XS, cierre[0]), masCercano(YS, cierre[1]));
  const dirInicial = salida === 'derecha' ? 0 : salida === 'izquierda' ? 1 : salida === 'abajo' ? 2 : 3;

  const celdas = buscar([i0, j0, dirInicial], [i1, j1], uso);
  const puntos = alinear(
    recta([origen, arranque, ...celdas.map(([i, j]) => [XS[i], YS[j]]), cierre, destino]),
    salida,
    entrada,
  );

  for (let k = 1; k < celdas.length; k += 1) {
    const c1 = celdas[k - 1][1] * ANCHO_REJILLA + celdas[k - 1][0];
    const c2 = celdas[k][1] * ANCHO_REJILLA + celdas[k][0];
    const llave = `${Math.min(c1, c2)}:${Math.max(c1, c2)}`;
    uso.set(llave, (uso.get(llave) ?? 0) + 1);
  }

  return { d: redondear(puntos), puntos, largo: largoDe(puntos) };
}
