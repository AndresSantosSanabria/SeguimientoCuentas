import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Tarjeta de KPI del sistema Bento. Sin icono: la cifra manda. La variante
 * «destacada» pinta la tarjeta en coral para la métrica que exige atención.
 */
export function KpiCard({ label, value, hint, footer, to, title, destacada = false }) {
  const tarjeta = (
    <article className={`card kpi-card${destacada ? ' kpi-card-destacada' : ''}`}>
      <div className="kpi-cabecera">
        <div className="kpi-cuerpo">
          <p className="field-label">{label}</p>
          <p className="kpi-valor">{value}</p>
          {hint ? <p className="kpi-pista">{hint}</p> : null}
          {to ? (
            <p className="kpi-enlace-pista">
              Ver en el listado
              <ArrowUpRight />
            </p>
          ) : null}
        </div>
      </div>
      {footer ? <div className="kpi-pie">{footer}</div> : null}
    </article>
  );

  if (!to) return tarjeta;

  return (
    <Link to={to} className="kpi-card-enlace" title={title} aria-label={`${label}. Ver estos contratos en el listado.`}>
      {tarjeta}
    </Link>
  );
}
