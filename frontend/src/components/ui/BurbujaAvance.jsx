import { useEffect, useId, useRef, useState } from 'react';

/**
 * Burbuja animada de avance (estilo liquid-fill): el agua sube hasta el porcentaje,
 * dos olas cruzan en bucle, burbujas ascienden dentro del agua y el anillo dibuja el
 * mismo avance. El nivel y el conteo se animan solo cuando cambia el %.
 * Respeta prefers-reduced-motion (queda estatica en el valor final).
 */
const DURACION = 900;

// Geometria del disco: centro 50, radio del agua 40, radio del anillo 46.
const CENTRO = 50;
const RADIO_AGUA = 40;
const RADIO_ANILLO = 46;
const TOPE_AGUA = CENTRO - RADIO_AGUA;
const BASE_AGUA = CENTRO + RADIO_AGUA;
const PERIODO = 100;

/** Seno muestreado en 0..200 (dos periodos): el desplazamiento de un periodo es continuo. */
function crearOla(amplitud, fase) {
  const puntos = [];
  for (let x = 0; x <= 200; x += 4) {
    const y = Math.sin((x / PERIODO) * Math.PI * 2 + fase) * amplitud;
    puntos.push(`${x} ${y.toFixed(2)}`);
  }
  return `M${puntos.join(' L')} L200 240 L0 240 Z`;
}

const OLA_DELANTERA = crearOla(6, 0);
const OLA_TRASERA = crearOla(4.5, Math.PI * 0.85);

const BURBUJAS = [
  { x: 32, r: 2.4, retraso: 0 },
  { x: 46, r: 1.6, retraso: 1.1 },
  { x: 58, r: 2, retraso: 2.2 },
  { x: 68, r: 1.3, retraso: 3.1 },
];

function useConteo(objetivo) {
  const [valor, setValor] = useState(objetivo);
  const desde = useRef(objetivo);

  useEffect(() => {
    // El conteo del numero se mantiene aunque el sistema pida menos movimiento:
    // cambiar un digito no mueve nada en el espacio y es justo el dato que se busca.
    if (desde.current === objetivo) {
      desde.current = objetivo;
      setValor(objetivo);
      return undefined;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let raf = 0;
    const tick = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / DURACION);
      const suave = 1 - (1 - t) ** 3;
      const v = Math.round(origen + (objetivo - origen) * suave);
      desde.current = v;
      setValor(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [objetivo]);

  return valor;
}

export function BurbujaAvance({ pct = 0, tono = 'brand', size = 88 }) {
  const seguro = Math.max(0, Math.min(100, Math.round(pct)));
  const mostrado = useConteo(seguro);
  const nivel = BASE_AGUA - (seguro / 100) * (BASE_AGUA - TOPE_AGUA);
  const recorte = useId();
  // El agua alcanza la base del numero a partir del 40 %: desde ahi el texto va en blanco.
  const sobreAgua = seguro >= 40;

  return (
    <div
      className="burbuja-avance"
      data-tono={tono}
      data-agua={sobreAgua ? 'si' : 'no'}
      style={{ inlineSize: size, blockSize: size }}
      role="img"
      aria-label={`Avance de la cuenta: ${seguro}%`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={recorte}>
            <circle cx={CENTRO} cy={CENTRO} r={RADIO_AGUA} />
          </clipPath>
        </defs>

        <circle className="burbuja-avance-pista" cx={CENTRO} cy={CENTRO} r={RADIO_AGUA} />

        <g clipPath={`url(#${recorte})`}>
          <g
            className="burbuja-avance-nivel"
            style={{ transform: `translateY(${nivel.toFixed(2)}px)` }}
          >
            <path className="burbuja-avance-ola burbuja-avance-ola-a" d={OLA_TRASERA} />
            <path className="burbuja-avance-ola burbuja-avance-ola-b" d={OLA_DELANTERA} />
          </g>

          <g className="burbuja-avance-burbujas">
            {BURBUJAS.map((b) => (
              <circle
                key={b.x}
                className="burbuja-avance-burbuja"
                cx={b.x}
                cy={BASE_AGUA - 4}
                r={b.r}
                style={{
                  animationDelay: `${b.retraso}s`,
                  // Solo ascienden dentro del agua: la subida no pasa de la linea de oleaje.
                  '--subida': `${Math.max(0, BASE_AGUA - 6 - nivel).toFixed(2)}px`,
                }}
              />
            ))}
          </g>
        </g>

        <circle
          className="burbuja-avance-anillo-pista"
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_ANILLO}
        />

        <circle
          className="burbuja-avance-anillo"
          cx={CENTRO}
          cy={CENTRO}
          r={RADIO_ANILLO}
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - seguro}
        />

        <text className="burbuja-avance-valor" x={CENTRO} y={CENTRO + 1}>
          {mostrado}%
        </text>
      </svg>
    </div>
  );
}
