import { Badge } from '@/components/ui/Badge';
import { BLOQUES } from '@/lib/bloques';
import { formatNumber } from '@/lib/format';

/**
 * Franja superior del mapa: los ocho bloques funcionales con sus conteos de
 * cuentas en curso y en devolución. El bloque elegido queda marcado como "en foco".
 */
export function MapaBloques({ conteo, totales, seleccionado, onSelect }) {
  return (
    <section className="mapa-bloques" aria-label="Mapa general de los ocho bloques funcionales">
      <header className="mapa-bloques-cabecera">
        <div className="mapa-bloques-texto">
          <p className="eyebrow">Dónde están las cuentas ahora</p>
          <h2 className="card-title">Mapa General de los 8 Bloques Funcionales</h2>
          <p className="card-subtitle">
            Cuentas de cobro en trámite por bloque funcional. Selecciona un bloque para enfocar su
            análisis.
          </p>
        </div>
        <div className="mapa-bloques-totales">
          <span data-modo="curso" className="mapa-bloques-total">
            <strong>{formatNumber(totales.enCurso)}</strong> En Curso
          </span>
          <span data-modo="devolucion" className="mapa-bloques-total">
            <strong>{formatNumber(totales.devolucion)}</strong> Devolución
          </span>
        </div>
      </header>

      <div className="mapa-bloques-rejilla">
        {BLOQUES.map((bloque) => {
          const datos = conteo.get(bloque.id) ?? { curso: 0, devolucion: 0 };
          const activo = seleccionado === bloque.id;
          return (
            <button
              key={bloque.id}
              type="button"
              aria-pressed={activo}
              onClick={() => onSelect(bloque.id)}
              className="bloque-tarjeta"
            >
              <span className="bloque-tarjeta-cima">
                <span className="bloque-tarjeta-numero">#{bloque.numero}</span>
                {activo ? <span className="bloque-tarjeta-foco">En foco</span> : null}
              </span>
              <span className="bloque-tarjeta-nombre">{bloque.nombre}</span>
              <span className="bloque-tarjeta-actividad">{bloque.actividad}</span>
              <span className="bloque-tarjeta-conteos">
                <span data-modo="curso" className="bloque-tarjeta-conteo">
                  {formatNumber(datos.curso)} Cur.
                </span>
                <span data-modo="devolucion" className="bloque-tarjeta-conteo">
                  {formatNumber(datos.devolucion)} Dev.
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mapa-bloques-leyenda">
        <Badge tone="success" dot>
          {formatNumber(totales.enCurso)} cuentas en curso
        </Badge>
        <Badge tone="warning" dot>
          {formatNumber(totales.devolucion)} en devolución
        </Badge>
        <span className="mapa-bloques-nota">
          Solo cuentas que ya arrancaron: las sin iniciar y las pagadas/cerradas quedan fuera.
        </span>
      </div>
    </section>
  );
}
