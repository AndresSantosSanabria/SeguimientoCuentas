export function KpiSkeleton() {
  return (
    <div className="card esqueleto-tarjeta">
      <div className="kpi-cabecera">
        <div className="esqueleto-cuerpo">
          <div className="esqueleto-trazo esqueleto-etiqueta" />
          <div className="esqueleto-trazo esqueleto-valor" />
          <div className="esqueleto-trazo esqueleto-pista" />
        </div>
        <div className="esqueleto-icono" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 288 }) {
  return (
    <div className="card esqueleto-tarjeta" style={{ minHeight: height }}>
      <div className="esqueleto-cabecera">
        <div className="esqueleto-trazo esqueleto-titulo" />
        <div className="esqueleto-trazo esqueleto-subtitulo" />
      </div>
      <div className="esqueleto-grafico" />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="card esqueleto-tabla">
      <div className="esqueleto-barra-tabla" />
      <div className="esqueleto-filas">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="esqueleto-fila">
            <div className="esqueleto-columna esqueleto-columna-contrato" />
            <div className="esqueleto-columna esqueleto-columna-fluida" />
            <div className="esqueleto-columna esqueleto-columna-estado" />
            <div className="esqueleto-columna esqueleto-columna-avance" />
          </div>
        ))}
      </div>
    </div>
  );
}
