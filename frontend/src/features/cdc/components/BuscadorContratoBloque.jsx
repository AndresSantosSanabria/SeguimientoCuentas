import { Search, X } from 'lucide-react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { bloquePorId, clasificarCuenta, etiquetaCuenta } from '@/features/cuentas';
import { coincideTexto } from '@/shared/utils';

const MAX_SUGERENCIAS = 8;

/**
 * Dónde está un contrato en el mapa: la cuenta que hoy tiene en trámite. Si tiene varias,
 * se prioriza la activa y, dentro de esas, la que está en curso (no devuelta). Devuelve null
 * cuando ninguna cuenta cae en un bloque (sin iniciar o ya cerrada): ese contrato no aparece.
 */
function ubicarContrato(contrato) {
  let mejor = null;
  for (const cuenta of contrato?.cuentasDetalle ?? []) {
    const clase = clasificarCuenta(cuenta);
    if (!clase) continue;
    const prioridad = (cuenta.activa ? 2 : 0) + (clase.modo === 'curso' ? 1 : 0);
    if (!mejor || prioridad > mejor.prioridad) {
      mejor = { prioridad, bloqueId: clase.bloque, cuenta };
    }
  }
  return mejor ? { bloqueId: mejor.bloqueId, cuenta: mejor.cuenta } : null;
}

export function BuscadorContratoBloque({ contratos, onSeleccionar }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const sugerencias = useMemo(() => {
    const termino = texto.trim();
    if (!termino) return [];
    const resultados = [];
    for (const contrato of contratos ?? []) {
      if (!coincideTexto(termino, contrato?.noContrato, contrato?.contratista)) continue;
      const ubicacion = ubicarContrato(contrato);
      if (!ubicacion) continue;
      resultados.push({ contrato, ...ubicacion });
      if (resultados.length >= MAX_SUGERENCIAS) break;
    }
    return resultados;
  }, [contratos, texto]);

  function elegir(item) {
    onSeleccionar(item.bloqueId, {
      contrato: item.contrato?.noContrato,
      cuenta: item.cuenta?.idInformeActividad,
    });
    setTexto(item.contrato?.noContrato ?? '');
    setAbierto(false);
  }

  return (
    <div className="buscador-bloque" ref={raiz}>
      <span className="buscador-bloque-campo">
        <Search className="input-icono" aria-hidden="true" />
        <input
          className="input input-corto input-con-icono"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar contrato y verlo en su bloque…"
          aria-label="Buscar contrato para ir a su bloque"
        />
        {texto ? (
          <button
            type="button"
            className="buscador-bloque-limpiar"
            onClick={() => setTexto('')}
            aria-label="Limpiar búsqueda"
          >
            <X />
          </button>
        ) : null}
      </span>

      {abierto && texto.trim() ? (
        <ul className="buscador-bloque-lista" role="listbox">
          {sugerencias.map((item) => {
            const bloque = bloquePorId(item.bloqueId);
            return (
              <li key={`${item.contrato?.noContrato}-${item.cuenta?.idInformeActividad}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="buscador-bloque-opcion"
                  onClick={() => elegir(item)}
                >
                  <span className="buscador-bloque-opcion-texto">
                    <span className="buscador-bloque-contrato">{item.contrato?.noContrato}</span>
                    <span className="buscador-bloque-contratista">
                      {item.contrato?.contratista ?? 'Contratista no disponible'} · {etiquetaCuenta(item.cuenta)}
                    </span>
                  </span>
                  {bloque ? (
                    <span className="buscador-bloque-marca">
                      #{bloque.numero} {bloque.nombre}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {sugerencias.length === 0 ? (
            <li className="buscador-bloque-vacio">Ningún contrato en trámite coincide con la búsqueda.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
