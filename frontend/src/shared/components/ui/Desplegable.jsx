import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Desplegable con diseño propio: la pastilla muestra la etiqueta y el valor elegido
 * y abre una lista flotante con las opciones. Sustituye al <select> nativo, cuya
 * lista de opciones la dibuja el sistema y se ve ajena al resto de la pantalla.
 */
export function Desplegable({ etiqueta, valor, opciones, onChange, activa, className = '' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAbierto(false);
    };
    const tecla = (evento) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const elegida = opciones.find((opcion) => opcion.value === valor);

  return (
    <div
      ref={raiz}
      className={`pilla-filtro${activa ? ' pilla-filtro-activa' : ''}${abierto ? ' pilla-filtro-abierto' : ''}${className ? ` ${className}` : ''}`}
    >
      {etiqueta ? (<span className="pilla-filtro-nombre">{etiqueta}</span>) : null}
      <button
        type="button"
        className="pilla-filtro-valor"
        onClick={() => setAbierto((previo) => !previo)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title={elegida?.label ?? ''}
      >
        {elegida?.label ?? '—'}
      </button>
      <ChevronDown className={`pilla-filtro-caret${abierto ? ' girada' : ''}`} aria-hidden="true"/>
      {abierto ? (
        <ul className="desplegable-lista" role="listbox">
          {opciones.map((opcion) => {
            const marcada = opcion.value === valor;
            return (
              <li key={opcion.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={marcada}
                  className="desplegable-opcion"
                  onClick={() => {
                    onChange(opcion.value);
                    setAbierto(false);
                  }}
                >
                  <span className="desplegable-opcion-texto">{opcion.label}</span>
                  {marcada ? (<Check className="desplegable-opcion-marca"/>) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
