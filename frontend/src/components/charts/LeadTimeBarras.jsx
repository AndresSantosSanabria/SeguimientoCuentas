import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/components/charts/ChartTooltip';
import { ETAPAS, formatDuracion } from '@/lib/leadTime';
import { formatNumber, formatPercentReal, truncate } from '@/lib/format';

function LeadTimeTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;
  const muertos = fila.aprobacion + fila.cola;
  return (
    <div className="tooltip-grafico tooltip-grafico-ancha">
      <p className="tooltip-titulo">{fila.label}</p>
      <div className="tooltip-lista-cifras">
        {ETAPAS.map((etapa) => (
          <p className="tooltip-dato" key={etapa.id}>
            <span>
              <span className="tooltip-muestra" style={{ backgroundColor: etapa.color }} />
              {etapa.label}
              {etapa.tipo === 'muerto' ? ' (tiempo muerto)' : ''}
            </span>
            <span className="tooltip-dato-valor">{formatDuracion(fila[etapa.id])}</span>
          </p>
        ))}
        <p className="tooltip-dato">
          <span>Lead Time Total</span>
          <span className="tooltip-dato-valor">{formatDuracion(fila.total)}</span>
        </p>
      </div>
      <p className="tooltip-veredicto tooltip-veredicto-malo">
        {formatPercentReal((muertos / fila.total) * 100, 1)} del tiempo es muerto · {formatNumber(fila.cuentas)}{' '}
        {fila.cuentas === 1 ? 'cuenta' : 'cuentas'}
      </p>
      <p className="tooltip-pista">Cada tramo se atribuye al estado que la cuenta tenía en ese período.</p>
    </div>
  );
}

/** Barras apiladas: cada bloque (#1…#8) reparte su lead time en las cuatro etapas. */
export function LeadTimeBarras({ data, height = 320 }) {
  // La escala del eje sigue la magnitud del dato: con lapsos de minutos leer
  // «0 d» no sirve, así que el eje pasa a horas o a minutos.
  const maximo = data.reduce((max, fila) => Math.max(max, fila.total), 0);
  const escala = maximo >= 1
    ? { unit: ' d', tick: (value) => String(value) }
    : maximo >= 1 / 24
      ? { unit: ' h', tick: (value) => String(Math.round(value * 24 * 10) / 10).replace('.', ',') }
      : { unit: ' min', tick: (value) => String(Math.round(value * 1440)) };
  return (
    <div className="pila-bloque">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            unit={escala.unit}
            tickFormatter={escala.tick}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={168}
            tickFormatter={(value) => truncate(value, 26)}
          />
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={<LeadTimeTooltip />} />
          {ETAPAS.map((etapa, index) => (
            <Bar
              key={etapa.id}
              dataKey={etapa.id}
              name={etapa.label}
              stackId="etapas"
              fill={etapa.color}
              maxBarSize={22}
              radius={index === ETAPAS.length - 1 ? [0, 6, 6, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="leyenda-cuentas">
        {ETAPAS.map((etapa) => (
          <span className="leyenda-item" key={etapa.id}>
            <span className="leyenda-muestra" style={{ backgroundColor: etapa.color }} />
            {etapa.label}
            <span className="texto-apoyo">
              ({etapa.tipo === 'valor' ? 'con valor' : 'muerto'})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
