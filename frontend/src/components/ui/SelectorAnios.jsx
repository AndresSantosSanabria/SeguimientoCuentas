import { ChevronDown, ListChecks } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function SelectorAnios({ opciones, valor, onChange, anioActual, etiqueta = 'Años' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAbierto(false);
    };
    const tecla = (evento) => { if (evento.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const alternar = (anio) => {
    if (opciones.length === 1 || (valor.length === 1 && valor[0] === anio)) return;
    const seleccion = valor.length === 0 ? [...opciones] : [...valor];
    const siguiente = seleccion.includes(anio)
      ? seleccion.filter((item) => item !== anio)
      : [...seleccion, anio].sort((a, b) => b - a);
    onChange(siguiente.length === opciones.length ? [] : siguiente);
  };
  const texto = valor.length === 0
    ? `Todos (${opciones.length})`
    : valor.length === 1
      ? String(valor[0])
      : `${valor.length} años`;

  return (
    <div className="selector" ref={raiz}>
      <span className="field-label-corto">{etiqueta}</span>
      <button type="button" className="selector-boton input input-corto" onClick={() => setAbierto((previo) => !previo)} aria-expanded={abierto} title={texto}>
        <ListChecks />
        <span className="selector-boton-texto">{texto}</span>
        <ChevronDown className="selector-boton-flecha" />
      </button>
      {abierto ? (
        <div className="selector-lista">
          <div className="selector-acciones">
            <span className="selector-recuento">{valor.length || opciones.length} de {opciones.length}</span>
            <button type="button" className="selector-accion" onClick={() => onChange([])} disabled={valor.length === 0}>Todos</button>
            <button type="button" className="selector-accion" onClick={() => onChange([anioActual])} disabled={valor.length === 1 && valor[0] === anioActual}>Año actual</button>
          </div>
          <ul className="selector-opciones">
            {opciones.map((anio) => (
              <li key={anio}>
                <label className="selector-opcion">
                  <input type="checkbox" className="campo-check-input" checked={valor.length === 0 || valor.includes(anio)} onChange={() => alternar(anio)} />
                  <span className="selector-opcion-texto">{anio}{anio === anioActual ? ' · actual' : ''}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
