import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/features/analitica/components/charts/ChartTooltip';
import { estiloTooltipDentroDeGrafica } from '@/features/analitica/components/charts/estiloTooltipDentroDeGrafica';
import { formatNumber, formatPercent } from '@/shared/utils';

function MoraTooltip({ active, payload, series }) {
  if (!active || !payload || payload.length === 0) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="tooltip-grafico tooltip-grafico-ancha">
      <p className="tooltip-titulo">{punto.mesLargo}</p>
      <div className="tooltip-lista-cifras">
        {payload
          .filter((entrada) => typeof entrada.value === 'number')
          .map((entrada) => {
            const detalle = punto.detalle?.[entrada.dataKey];
            const serie = series.find((item) => item.clave === entrada.dataKey);
            return (
              <p className="tooltip-dato" key={entrada.dataKey}>
                <span>
                  <span className="tooltip-muestra" style={{ backgroundColor: entrada.color ?? serie?.color }} />
                  {serie?.label ?? entrada.name}
                </span>
                <span className="tooltip-dato-valor">
                  {formatPercent(entrada.value, 1)}
                  <span className="tooltip-porcentaje">
                    {formatNumber(detalle?.pendientes ?? 0)}/{formatNumber(detalle?.exigibles ?? 0)}
                  </span>
                </span>
              </p>
            );
          })}
      </div>
      <p className="tooltip-pista">Cifras: cuentas exigibles sin cuenta radicada sobre las exigibles acumuladas.</p>
    </div>
  );
}

/**
 * Líneas multi-serie: la tasa de mora mes a mes de cada secretaría elegida.
 * Muestra quién entra rezagado y quién va cerrando la brecha.
 */
export function MoraMensualLineas({ puntos, series, height = 300 }) {
  return (
    <div className="pila-bloque">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={puntos} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe6ea" />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={46}
          />
          <Tooltip
            cursor={{ stroke: '#a0aec0' }}
            content={<MoraTooltip series={series} />}
            wrapperStyle={estiloTooltipDentroDeGrafica({ anchoEje: 46, margenIzquierda: 0, margenDerecha: 16 })}
          />
          {series.map((serie) => (
            <Line
              key={serie.clave}
              type="monotone"
              dataKey={serie.clave}
              name={serie.label}
              stroke={serie.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="leyenda-cuentas">
        {series.map((serie) => (
          <span className="leyenda-item" key={serie.clave}>
            <span className="leyenda-muestra" style={{ backgroundColor: serie.color }} />
            {serie.label}
          </span>
        ))}
      </div>
    </div>
  );
}
