import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber, formatPercent } from '@/lib/format';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

export function SupervisionDonut({ conSupervision, sinSupervision, cobertura }) {
  const total = conSupervision + sinSupervision;
  const data = [
    { label: 'Con supervisión', value: conSupervision, color: '#1e7fd8' },
    { label: 'Sin supervisión', value: sinSupervision, color: '#cbd5e1' },
  ];
  return (
    <div className="donut">
      <div className="donut-lienzo">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-centro">
          <span className="donut-cobertura">{formatPercent(cobertura, 1)}</span>
          <span className="donut-sub">Cobertura</span>
        </div>
      </div>

      <ul className="donut-leyenda">
        {data.map((entry) => (
          <li key={entry.label} className="donut-leyenda-item">
            <span className="donut-leyenda-clave">
              <span className="donut-leyenda-muestra" style={{ backgroundColor: entry.color }} />
              {entry.label}
            </span>
            <span className="donut-leyenda-valor">{formatNumber(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
