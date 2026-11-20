import { formatNumber, formatPercentReal } from '@/shared/utils';

export function ChartTooltip({ active, payload, label, total }) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload.filter((entry) => typeof entry.value === 'number');
  if (entries.length === 0) return null;
  const title = label ?? entries[0]?.payload?.label ?? '';
  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{title}</p>
      <div className="tooltip-lista">
        {entries.map((entry, index) => {
          const value = Number(entry.value ?? 0);
          const rowName =
            entry.name && entry.name !== 'value'
              ? String(entry.name)
              : (entry.payload?.label ?? 'Cantidad');
          return (
            <div key={`${rowName}-${index}`} className="tooltip-fila">
              <span className="tooltip-clave">
                <span className="tooltip-muestra" style={{ backgroundColor: entry.color ?? '#5a6b76' }} />
                <span className="tooltip-nombre">{rowName}</span>
              </span>
              <span className="tooltip-valor">
                {formatNumber(value)}
                {total && total > 0 ? (
                  <span className="tooltip-porcentaje">({formatPercentReal((value / total) * 100, 2)})</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CHART_COLORS = [
  '#17699b',
  '#3e88b4',
  '#4a63a8',
  '#6b62a0',
  '#8f5f80',
  '#a16207',
  '#1e7a46',
  '#2b8ab8',
  '#b3261e',
  '#56646d',
];

export const AXIS_TICK = { fill: '#5a6b76', fontSize: 11 };
