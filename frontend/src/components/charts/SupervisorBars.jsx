import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/components/charts/ChartTooltip';
import { formatNumber, truncate } from '@/lib/format';

function SupervisorTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const supervisor = payload[0]?.payload;
  if (!supervisor) return null;
  const acumuladas = supervisor.represadas > 0;
  return (
    <div className="tooltip-grafico tooltip-grafico-ancha">
      <p className="tooltip-titulo">{supervisor.label}</p>
      <div className="tooltip-lista-cifras">
        <p className="tooltip-dato">
          <span>Contratos</span>
          <span className="tooltip-dato-valor">{formatNumber(supervisor.value)}</span>
        </p>
        <p className="tooltip-dato">
          <span>Cuentas a tiempo</span>
          <span className="tooltip-dato-valor tooltip-dato-bueno">{formatNumber(supervisor.alDia)}</span>
        </p>
        <p className="tooltip-dato">
          <span>Cuentas represadas</span>
          <span
            className={
              acumuladas
                ? 'tooltip-dato-valor tooltip-dato-malo'
                : 'tooltip-dato-valor'
            }
          >
            {formatNumber(supervisor.represadas)}
          </span>
        </p>
      </div>
      <p
        className={
          acumuladas
            ? 'tooltip-veredicto tooltip-veredicto-malo'
            : 'tooltip-veredicto tooltip-veredicto-bueno'
        }
      >
        {acumuladas
          ? `Tiene ${formatNumber(supervisor.represadas)} cuentas vencidas sin radicar`
          : 'Sin cuentas vencidas: todos al día'}
      </p>
      <p className="tooltip-pista">Selecciona la barra para ver los contratistas.</p>
    </div>
  );
}

export function SupervisorBars({ data, height = 320, onSupervisorSelect }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          width={190}
          tickFormatter={(value) => truncate(value, 28)}
        />
        <Tooltip cursor={{ fill: '#f1f5f9' }} content={<SupervisorTooltip />} />
        <Bar
          dataKey="value"
          name="Contratos"
          fill="#1e7fd8"
          radius={[0, 6, 6, 0]}
          maxBarSize={20}
          onClick={(entry) => {
            const supervisor = entry?.payload ?? entry;
            if (supervisor?.label && onSupervisorSelect) onSupervisorSelect(supervisor);
          }}
          cursor={onSupervisorSelect ? 'pointer' : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
