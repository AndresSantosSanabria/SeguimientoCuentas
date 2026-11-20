export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="estado-centrado">
      {Icon ? (
        <span className="icono-globo icono-globo-estado">
          <Icon />
        </span>
      ) : null}
      <p className="estado-titulo">{title}</p>
      {description ? <p className="estado-detalle">{description}</p> : null}
      {action ? <div className="estado-accion">{action}</div> : null}
    </div>
  );
}
