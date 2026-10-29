export function Card({ children, className = '', tone }) {
  return (
    <section data-tone={tone} className={`card ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <header className={`card-header ${className}`}>
      <div className="card-header-cuerpo">
        <h2 className="card-title">{title}</h2>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="card-header-accion">{action}</div> : null}
    </header>
  );
}
