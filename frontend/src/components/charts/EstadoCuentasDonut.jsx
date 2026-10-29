import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber, formatPercentReal } from '@/lib/format';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

export function EstadoCuentasDonut({ enProceso, devolucionRechazo, pctEnProceso }) {
  const total = enProceso + devolucionRechazo;
  const data = [
    { label: 'En proceso', value: enProceso, color: '#1e7fd8' },
    { label: 'Devolución o rechazo', value: devolucionRechazo, color: '#f43f5e' },
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
          <span className="donut-cobertura">{formatPercentReal(pctEnProceso, 2)}</span>
          <span className="donut-sub">En proceso</span>
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
