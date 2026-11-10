import { ChevronDown, ListChecks, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { coincideTexto } from '@/lib/format';

function ordenarSecretarias(lista) {
  return [...lista].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Selector de secretarías con checkboxes. Selección vacía significa «todas», así
 * que el botón «Limpiar» no filtra nada: vuelve al estado por defecto.
 */
export function SelectorSecretarias({ opciones, valor, onChange, etiqueta = 'Secretarías' }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
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

  const visibles = useMemo(
    () => opciones.filter((opcion) => coincideTexto(busqueda, opcion)),
    [opciones, busqueda],
  );

  const alternar = (opcion) => {
    const siguiente = valor.includes(opcion)
      ? valor.filter((secretaria) => secretaria !== opcion)
      : ordenarSecretarias([...valor, opcion]);
    onChange(siguiente);
  };

  const texto = valor.length === 0
    ? `Todas (${opciones.length})`
    : valor.length === 1
      ? valor[0]
      : `${valor.length} secretarías`;

  return (
    <div className="selector" ref={raiz}>
      <span className="field-label-corto">{etiqueta}</span>
      <button
        type="button"
        className="selector-boton input input-corto"
        onClick={() => setAbierto((previo) => !previo)}
        aria-expanded={abierto}
        title={texto}
      >
        <ListChecks />
        <span className="selector-boton-texto">{texto}</span>
        <ChevronDown className="selector-boton-flecha" />
      </button>

      {abierto ? (
        <div className="selector-lista">
          <div className="selector-busqueda">
            <Search className="input-icono" />
            <input
              className="input input-corto input-con-icono input-xs"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar secretaría"
              aria-label={`Buscar dentro de ${etiqueta.toLowerCase()}`}
            />
          </div>

          <div className="selector-acciones">
            <span className="selector-recuento">
              {valor.length} de {opciones.length}
            </span>
            <button
              type="button"
              className="selector-accion"
              onClick={() => onChange(ordenarSecretarias(opciones))}
              disabled={valor.length === opciones.length}
            >
              Marcar todas
            </button>
            <button
              type="button"
              className="selector-accion"
              onClick={() => onChange([])}
              disabled={valor.length === 0}
            >
              Limpiar
            </button>
          </div>

          <ul className="selector-opciones">
            {visibles.map((opcion) => (
              <li key={opcion}>
                <label className="selector-opcion">
                  <input
                    type="checkbox"
                    className="campo-check-input"
                    checked={valor.includes(opcion)}
                    onChange={() => alternar(opcion)}
                  />
                  <span className="selector-opcion-texto">{opcion}</span>
                </label>
              </li>
            ))}
            {visibles.length === 0 ? (
              <li className="selector-vacio">Ninguna secretaría coincide con la búsqueda.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
