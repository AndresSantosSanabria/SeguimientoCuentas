export function KpiCard({ label, value, hint, icon: Icon, tone = 'brand', footer }) {
  return (
    <article className="card kpi-card">
      <div className="kpi-cabecera">
        <div className="kpi-cuerpo">
          <p className="field-label">{label}</p>
          <p className="kpi-valor">{value}</p>
          {hint ? <p className="kpi-pista">{hint}</p> : null}
        </div>
        <span data-tone={tone} className="icono-globo icono-globo-kpi">
          <Icon strokeWidth={2} />
        </span>
      </div>
      {footer ? <div className="kpi-pie">{footer}</div> : null}
    </article>
  );
}
