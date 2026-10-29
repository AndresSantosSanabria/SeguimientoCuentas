import { formatNumber, formatPercent } from '@/lib/format';

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
                <span className="tooltip-muestra" style={{ backgroundColor: entry.color ?? '#94a3b8' }} />
                <span className="tooltip-nombre">{rowName}</span>
              </span>
              <span className="tooltip-valor">
                {formatNumber(value)}
                {total && total > 0 ? (
                  <span className="tooltip-porcentaje">({formatPercent((value / total) * 100, 1)})</span>
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
  '#1e7fd8',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#84cc16',
  '#14b8a6',
  '#f43f5e',
  '#64748b',
];

export const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 };
