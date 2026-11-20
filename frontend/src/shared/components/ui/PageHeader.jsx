export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="encabezado-pagina">
      <div className="encabezado-pagina-texto">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="encabezado-pagina-titulo">{title}</h1>
        {description ? <p className="encabezado-pagina-detalle">{description}</p> : null}
      </div>
      {actions ? <div className="encabezado-pagina-acciones">{actions}</div> : null}
    </header>
  );
}
