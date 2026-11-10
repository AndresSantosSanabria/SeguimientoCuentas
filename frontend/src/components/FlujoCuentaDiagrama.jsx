import { Maximize2, Minus, Play, Plus, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALTO,
  ANCHO,
  CARRILES,
  CHARCO_BAJO,
  CHARCOS,
  COMPUERTAS,
  CONECTORES,
  EVENTOS,
  ETIQUETAS,
  NODOS,
} from '@/lib/flujoCuentaDiagrama';
import { CAJAS, FLECHAS, OCULTOS } from '@/lib/flujoFlechas';
import { estadoLabel } from '@/lib/estados';
import { formatDateTime } from '@/lib/format';
import { pintarRecorrido } from '@/lib/flujoRecorrido';

const NODOS_VISIBLES = NODOS.filter((n) => !OCULTOS.has(n.id));

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.4;
// En recorridos largos (toda la cadena de tesorería) encajar el trayecto entero obliga a un zoom
// ilegible: se abre a escala de lectura sobre el punto actual y el resto queda al alcance del scroll.
const ZOOM_LEGIBLE = 0.72;
const LECTURA = { base: 10, sm: 9.5, xs: 9 };
const DIBUJO_MIN = 480;
const DIBUJO_MAX = 1050;

const acotar = (v, min, max) => Math.min(max, Math.max(min, v));

function TextoCaja({ caja }) {
  const tamano = LECTURA[caja.escala] ?? LECTURA.base;
  const salto = tamano * 1.24;
  const linea = caja.lineas.length;
  const inicio = -((linea - 1) * salto) / 2;
  const izquierda = caja.alineacion === 'izquierda';
  const x = izquierda ? caja.x + 6 : caja.x + caja.w / 2;
  return (
    <text
      className="d-texto"
      x={x}
      y={caja.y + caja.h / 2}
      textAnchor={izquierda ? 'start' : 'middle'}
      dominantBaseline="middle"
      fontSize={tamano}
    >
      {caja.lineas.map((t, i) => (
        <tspan key={`${t}-${i}`} x={x} dy={i === 0 ? inicio : salto}>
          {t}
        </tspan>
      ))}
    </text>
  );
}

export function FlujoCuentaDiagrama({ pasos = [], enTramite = true }) {
  const recorrido = useMemo(() => pintarRecorrido(pasos, enTramite), [pasos, enTramite]);
  const total = recorrido.pasos.length;

  // Las flechas que ya pinta el recorrido se esconden del fondo: si no, se verían duplicadas.
  const usadas = useMemo(
    () => new Set(recorrido.tramos.map((t) => t.flecha).filter((f) => typeof f === 'number')),
    [recorrido],
  );
  const flechasPorPaso = useMemo(() => {
    const mapa = new Map();
    recorrido.tramos.forEach((t, k) => {
      if (!mapa.has(t.paso)) mapa.set(t.paso, []);
      mapa.get(t.paso).push(k);
    });
    return mapa;
  }, [recorrido]);

  const [zoom, setZoom] = useState(0.75);
  const [paso, setPaso] = useState(null);
  const [jugando, setJugando] = useState(false);
  const [sobre, setSobre] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  // Cajas que la punta del trazo ya tocó. Sin esto el paso entero se encendería al empezar.
  const [tocado, setTocado] = useState(() => new Set());

  const marcar = useCallback((id) => {
    setTocado((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const lienzoRef = useRef(null);
  const tramoRefs = useRef([]);
  const focoRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const centrar = useCallback((caja, suavidad = 1) => {
    const lienzo = lienzoRef.current;
    if (!lienzo || !caja) return;
    const z = zoomRef.current;
    const x = Math.max(0, (caja.x + caja.w / 2) * z - lienzo.clientWidth / 2);
    const y = Math.max(0, (caja.y + caja.h / 2) * z - lienzo.clientHeight / 2);
    lienzo.scrollLeft += (x - lienzo.scrollLeft) * suavidad;
    lienzo.scrollTop += (y - lienzo.scrollTop) * suavidad;
  }, []);

  useEffect(() => {
    setPaso(null);
    setJugando(false);
    setTocado(new Set());
  }, [recorrido]);

  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo || !recorrido.bbox) return undefined;
    const { w, h } = recorrido.bbox;
    const z = acotar(
      Math.min((lienzo.clientWidth - 24) / w, (lienzo.clientHeight - 24) / h),
      ZOOM_LEGIBLE,
      1,
    );
    setZoom(z);
    zoomRef.current = z;
    const actual = recorrido.pasos[recorrido.pasos.length - 1];
    const caja = actual ? CAJAS.get(actual.nodoId) : null;
    const id = requestAnimationFrame(() => {
      if (caja) {
        lienzo.scrollLeft = Math.max(0, (caja.x + caja.w / 2) * z - lienzo.clientWidth / 2);
        lienzo.scrollTop = Math.max(0, (caja.y + caja.h / 2) * z - lienzo.clientHeight / 2);
        return;
      }
      const marco = recorrido.bbox;
      lienzo.scrollLeft = Math.max(0, (marco.x + marco.w / 2) * z - lienzo.clientWidth / 2);
      lienzo.scrollTop = Math.max(0, (marco.y + marco.h / 2) * z - lienzo.clientHeight / 2);
    });
    return () => cancelAnimationFrame(id);
  }, [recorrido]);

  useEffect(() => {
    if (!jugando) return undefined;
    if (paso === null) {
      setPaso(0);
      return undefined;
    }

    const nodo = CAJAS.get(recorrido.pasos[paso].nodoId);
    const indices = flechasPorPaso.get(paso) ?? [];
    const trazados = indices
      .map((k) => ({ el: tramoRefs.current[k], toca: recorrido.tramos[k].toca ?? [] }))
      .filter((t) => t.el);
    let raf = 0;
    let espera = 0;
    let vivo = true;

    // Ninguna flecha del paso se ve hasta que la punta llegue a ella: si no, el paso completo se
    // pinta de golpe y la animación no cuenta nada.
    for (const { el } of trazados) {
      el.style.strokeDashoffset = '1';
      el.style.markerEnd = 'none';
    }

    const siguiente = () => {
      if (paso >= total - 1) {
        setJugando(false);
        return;
      }
      espera = window.setTimeout(() => setPaso(paso + 1), 320);
    };

    if (paso === 0 || trazados.length === 0) {
      centrar(nodo);
      espera = window.setTimeout(siguiente, 700);
      return () => window.clearTimeout(espera);
    }

    const foco = focoRef.current;

    const animar = (k) => {
      if (!vivo) return;
      if (k >= trazados.length) {
        espera = window.setTimeout(siguiente, 380);
        return;
      }
      const { el, toca } = trazados[k];
      const largo = el.getTotalLength();
      const duracion = acotar(largo * 1.15, DIBUJO_MIN, DIBUJO_MAX);
      const inicio = performance.now();
      let pendientes = 0;
      el.style.markerEnd = '';

      const cuadro = (ahora) => {
        if (!vivo) return;
        const avance = Math.min(1, (ahora - inicio) / duracion);
        const suave = 1 - (1 - avance) * (1 - avance);
        el.style.strokeDashoffset = String(1 - suave);
        while (pendientes < toca.length && toca[pendientes].f <= suave) {
          marcar(toca[pendientes].id);
          pendientes += 1;
        }
        if (foco) {
          const punto = el.getPointAtLength(suave * largo);
          foco.setAttribute('cx', punto.x.toFixed(1));
          foco.setAttribute('cy', punto.y.toFixed(1));
        }
        centrar(nodo, 0.12);
        if (avance < 1) {
          raf = requestAnimationFrame(cuadro);
        } else {
          for (; pendientes < toca.length; pendientes += 1) marcar(toca[pendientes].id);
          el.style.removeProperty('stroke-dashoffset');
          animar(k + 1);
        }
      };

      raf = requestAnimationFrame(cuadro);
    };

    animar(0);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(espera);
      for (const { el } of trazados) {
        el.style.removeProperty('stroke-dashoffset');
        el.style.removeProperty('marker-end');
      }
    };
  }, [jugando, paso, total, recorrido, flechasPorPaso, centrar, marcar]);

  useEffect(() => {
    if (focoRef.current) focoRef.current.style.opacity = jugando ? '1' : '0';
  }, [jugando]);

  const alternar = () => {
    if (jugando) {
      setJugando(false);
      setPaso(null);
      return;
    }
    setPaso(null);
    setTocado(new Set(recorrido.pasos.length > 0 ? [recorrido.pasos[0].nodoId] : []));
    setJugando(true);
  };

  // El lienzo recorta lo que sale de su caja: el globo del nodo se pega a la parte visible para que
  // nunca quede cortado contra el borde del scroll.
  const ubicarTip = (el) => {
    const lienzo = lienzoRef.current;
    if (!lienzo || !el) return;
    const marco = lienzo.getBoundingClientRect();
    const caja = el.getBoundingClientRect();
    const mitad = 136;
    const centro = caja.left + caja.width / 2 - marco.left + lienzo.scrollLeft;
    const izquierda = Math.min(
      Math.max(centro, lienzo.scrollLeft + mitad + 8),
      lienzo.scrollLeft + lienzo.clientWidth - mitad - 8,
    );
    const arriba = caja.top - marco.top;
    const abajo = arriba < 130;
    setTipPos({
      left: izquierda,
      top: (abajo ? caja.bottom - marco.top + 10 : arriba - 10) + lienzo.scrollTop,
      abajo,
    });
  };

  const revelado = (indice) => paso === null || indice <= paso;

  // Una caja se enciende cuando la punta que dibuja la toca. Al saltar de paso con la barra, o al
  // terminar la reproducción, se asume todo el trayecto ya recorrido.
  const encendida = (indice, id) => {
    if (paso === null || indice < paso || tocado.has(id)) return true;
    return indice === paso && (flechasPorPaso.get(indice) ?? []).length === 0;
  };

  const idsHasta = (limite) => {
    const ids = new Set();
    recorrido.pasos.forEach((visita, k) => {
      if (k <= limite) ids.add(visita.nodoId);
    });
    for (const [id, cruce] of recorrido.cruzados) {
      if (cruce.indice <= limite) ids.add(id);
    }
    return ids;
  };

  const detalle = sobre ? recorrido.nodos.get(sobre) : null;
  const visiblePaso = paso === null ? total - 1 : paso;
  const pasoActual = total > 0 ? recorrido.pasos[Math.max(0, visiblePaso)] : null;

  return (
    <div className="flujo-diagrama">
      <div className="flujo-barra">
        <div className="flujo-leyenda">
          <span className="flujo-leyenda-item" data-tono="hecho">
            Ya pasó
          </span>
          <span className="flujo-leyenda-item" data-tono="actual">
            En curso
          </span>
          <span className="flujo-leyenda-item" data-tono="devuelta">
            Devolución
          </span>
          <span className="flujo-leyenda-item" data-tono="pendiente">
            Aún no llega
          </span>
        </div>
        <p className="flujo-recuento">
          {total > 0
            ? `${total} paradas · ${recorrido.gestiones} gestiones registradas`
            : 'Sin gestiones registradas todavía'}
        </p>
        <div className="flujo-herramientas">
          <button
            type="button"
            className="flujo-boton"
            aria-label="Alejar"
            onClick={() => setZoom((z) => Math.round(Math.max(ZOOM_MIN, z - 0.12) * 100) / 100)}
          >
            <Minus />
          </button>
          <span className="flujo-zoom-valor">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="flujo-boton"
            aria-label="Acercar"
            onClick={() => setZoom((z) => Math.round(Math.min(ZOOM_MAX, z + 0.12) * 100) / 100)}
          >
            <Plus />
          </button>
          <button
            type="button"
            className="flujo-boton flujo-boton-texto"
            onClick={() => {
              const lienzo = lienzoRef.current;
              if (!lienzo || !recorrido.bbox) return;
              const { w, h } = recorrido.bbox;
              const z = acotar(Math.min((lienzo.clientWidth - 24) / w, (lienzo.clientHeight - 24) / h), ZOOM_MIN, 1);
              setZoom(z);
              zoomRef.current = z;
              requestAnimationFrame(() => {
                lienzo.scrollLeft = Math.max(0, (recorrido.bbox.x + recorrido.bbox.w / 2) * z - lienzo.clientWidth / 2);
                lienzo.scrollTop = Math.max(0, (recorrido.bbox.y + recorrido.bbox.h / 2) * z - lienzo.clientHeight / 2);
              });
            }}
          >
            <Maximize2 />
            Ajustar
          </button>
        </div>
      </div>

      <div ref={lienzoRef} className="flujo-lienzo" data-jugando={jugando ? 'si' : 'no'}>
        <svg
          className="d-svg"
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          width={ANCHO * zoom}
          height={ALTO * zoom}
          role="img"
          aria-label="Diagrama del proceso de cuentas de cobro con el recorrido de esta cuenta"
          onMouseLeave={() => setSobre(null)}
        >
          <defs>
            {['pendiente', 'hecho', 'actual', 'devuelta', 'futuro'].map((tono) => (
              <marker
                key={tono}
                id={`d-flecha-${tono}`}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L7,3.5 L0,7 Z" className={`d-punta d-punta-${tono}`} />
              </marker>
            ))}
          </defs>

          <g className="d-cimiento">
            <rect className="d-pool" x="13" y="13" width={ANCHO - 33} height={CHARCO_BAJO - 13} />
            {CARRILES.map((c, i) => (
              <line key={`linea-${c.top}-${i}`} className="d-carril" x1="13" y1={c.top} x2={ANCHO - 20} y2={c.top} />
            ))}
            <line className="d-carril" x1="13" y1={CHARCO_BAJO} x2={ANCHO - 20} y2={CHARCO_BAJO} />
            {CHARCOS.map((c) => (
              <line key={`borde-${c.nombre}`} className="d-charco" x1={c.hasta} y1="13" x2={c.hasta} y2={CHARCO_BAJO} />
            ))}
            <line className="d-charco" x1="58" y1="13" x2="58" y2={CHARCO_BAJO} />
            {CHARCOS.map((c) => (
              <text key={`titulo-${c.nombre}`} className="d-charco-titulo" x={(c.desde + c.hasta) / 2} y="31" textAnchor="middle">
                {c.nombre}
              </text>
            ))}
            {CARRILES.map((c) => {
              const [principal, extra] = c.nombre.split(' (');
              return (
                <text
                  key={`rol-${c.nombre}`}
                  className="d-rol"
                  transform={`translate(30 ${c.top + c.alto / 2}) rotate(-90)`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan x="0">{principal.trim()}</tspan>
                  {extra ? <tspan x="0" dy="11">{`(${extra}`}</tspan> : null}
                </text>
              );
            })}
          </g>

          <g className="d-conectores">
            {CONECTORES.map((c, i) => (
              <path
                key={`${c.d}-${i}`}
                d={c.d}
                className="d-linea"
                data-traza={usadas.has(i) ? 'si' : 'no'}
                style={{ '--retraso': `${Math.min(i * 0.012, 0.9)}s` }}
              >
                <title>{c.grupo}</title>
              </path>
            ))}
          </g>

          <g className="d-tramos">
            {recorrido.tramos.map((t, k) => (
              <path
                key={`${t.paso}-${t.flecha}`}
                ref={(el) => {
                  tramoRefs.current[k] = el;
                }}
                className="d-tramo"
                d={t.d}
                pathLength="1"
                data-tono={revelado(t.paso) ? t.tono : 'futuro'}
                data-estado={
                  paso === null || t.paso < paso ? 'hecho' : t.paso === paso ? 'activo' : 'futuro'
                }
              />
            ))}
          </g>

          <g className="d-eventos">
            {EVENTOS.map((e, i) => (
              <circle
                key={`${e.tipo}-${i}`}
                className="d-evento"
                data-tipo={e.tipo}
                cx={e.x + 12}
                cy={e.y + 12}
                r={e.tipo === 'fin' ? 13 : 12}
                style={{ '--retraso': `${0.3 + i * 0.06}s` }}
              />
            ))}
          </g>

          <g className="d-compuertas">
            {COMPUERTAS.map((c, i) => {
              const lineas = c.etiqueta.split('\n');
              return (
                <g key={c.id} className="d-compuerta" style={{ '--retraso': `${0.2 + Math.min(i * 0.02, 0.5)}s` }}>
                  <polygon
                    className="d-compuerta-caja"
                    points={`${c.x + 18},${c.y} ${c.x + 36},${c.y + 18} ${c.x + 18},${c.y + 36} ${c.x},${c.y + 18}`}
                  />
                  {lineas.map((l, j) => (
                    <text
                      key={`${l}-${j}`}
                      className="d-compuerta-texto"
                      x={c.x + 18}
                      y={c.y - 11 - (lineas.length - 1 - j) * 10}
                      textAnchor="middle"
                    >
                      {l}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>

          <g className="d-nodos">
            {NODOS_VISIBLES.map((n, i) => {
              const activo = recorrido.nodos.get(n.id);
              const ver = activo ? encendida(activo.indice, n.id) : false;
              // Parada intermedia: la línea la cruza de camino aunque no corresponda a una gestión.
              const trazada = activo ? null : recorrido.cruzados.get(n.id);
              const verTrazada = trazada ? encendida(trazada.indice, n.id) : false;
              return (
                <g
                  key={n.id}
                  className="d-nodo"
                  data-tono={
                    activo && ver
                      ? activo.tono
                      : verTrazada
                        ? trazada.tono
                        : 'pendiente'
                  }
                  data-nodo={n.id}
                  style={{ '--retraso': `${0.05 + Math.min(i * 0.008, 0.5)}s` }}
                  tabIndex={activo ? 0 : -1}
                  aria-label={
                    activo
                      ? `${estadoLabel(activo.paso?.idEstado, activo.paso?.estado)}: ${n.lineas.join(' ')}`
                      : n.lineas.join(' ')
                  }
                  onMouseEnter={(e) => {
                    if (!activo || !ver) return;
                    setSobre(n.id);
                    ubicarTip(e.currentTarget);
                  }}
                  onMouseLeave={() => setSobre(null)}
                  onFocus={(e) => {
                    if (!activo || !ver) return;
                    setSobre(n.id);
                    ubicarTip(e.currentTarget);
                  }}
                  onBlur={() => setSobre(null)}
                >
                  <rect className="d-nodo-caja" x={n.x} y={n.y} width={n.w} height={n.h} rx="8" />
                  <TextoCaja caja={n} />
                  {activo && ver
                    ? (activo.visitas ?? [activo.indice]).map((visita, k, todas) => (
                        <g
                          key={visita}
                          className="d-insignia"
                          data-tono={activo.tono}
                          style={{
                            opacity: paso === null || tocado.has(n.id) || visita < paso ? 1 : 0,
                          }}
                          transform={`translate(${n.x + n.w - (todas.length - 1 - k) * 17} ${n.y})`}
                        >
                          <circle r="9" />
                          <text y="3.4" textAnchor="middle">{visita + 1}</text>
                        </g>
                      ))
                    : null}
                </g>
              );
            })}
          </g>

          <g className="d-bordes">
            {ETIQUETAS.map((t, i) => (
              <text
                key={`${t.texto}-${t.x}-${i}`}
                className="d-borde"
                x={t.x}
                y={t.y + 9}
                fontSize="9.5"
                style={{ '--retraso': `${0.4 + Math.min(i * 0.008, 0.6)}s` }}
              >
                {t.texto}
              </text>
            ))}
          </g>

          <circle ref={focoRef} className="d-foco" r="5.5" />
        </svg>

        {detalle && tipPos ? (
          <p
            className="flujo-tip"
            data-tono={detalle.tono}
            data-abajo={tipPos.abajo ? 'si' : 'no'}
            style={{ left: tipPos.left, top: tipPos.top }}
          >
            <strong>{estadoLabel(detalle.paso?.idEstado, detalle.paso?.estado)}</strong>
            {detalle.paso?.fecha ? (
              <span className="flujo-tip-fecha">{formatDateTime(detalle.paso.fecha)}</span>
            ) : null}
            {detalle.paso?.descripcion?.trim() ? (
              <span className="flujo-tip-nota">{detalle.paso.descripcion}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="flujo-reproductor">
          <button
            type="button"
            className="flujo-play"
            data-jugando={jugando ? 'si' : 'no'}
            onClick={alternar}
            disabled={total < 2}
          >
            {jugando ? <Square /> : <Play />}
            {jugando ? 'Detener' : 'Reproducir'}
          </button>

          <div className="flujo-pista">
            {recorrido.pasos.map((v, i) => (
              <button
                key={`${v.nodoId}-${i}`}
                type="button"
                className="flujo-marca"
                data-tono={v.tono}
                data-visto={paso === null || i <= paso ? 'si' : 'no'}
                aria-label={`Paso ${i + 1}: ${estadoLabel(v.paso.idEstado, v.paso.estado)}`}
                title={`${i + 1}. ${estadoLabel(v.paso.idEstado, v.paso.estado)}`}
                onClick={() => {
                  setJugando(false);
                  setPaso(i);
                  setTocado(idsHasta(i));
                  centrar(CAJAS.get(v.nodoId));
                }}
              />
            ))}
          </div>

          {pasoActual ? (
            <p className="flujo-paso-texto" aria-live="polite">
              <span className="flujo-paso-num">
                Paso {visiblePaso + 1} de {total}
              </span>
              <strong className="flujo-paso-titulo">
                {estadoLabel(pasoActual.paso.idEstado, pasoActual.paso.estado)}
              </strong>
              {pasoActual.paso.fecha ? (
                <span className="flujo-paso-fecha">{formatDateTime(pasoActual.paso.fecha)}</span>
              ) : null}
              {pasoActual.paso.descripcion?.trim() ? (
                <span className="flujo-paso-nota">{pasoActual.paso.descripcion}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
