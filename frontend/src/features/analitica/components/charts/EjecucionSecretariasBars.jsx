import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/features/analitica/components/charts/ChartTooltip';
import { estiloTooltipDentroDeGrafica } from '@/features/analitica/components/charts/estiloTooltipDentroDeGrafica';
import { EJECUCION_SERIES } from '@/features/analitica/utils/comparativaGraficas';
import { formatNumber, formatPercentReal, truncate } from '@/shared/utils';

function EjecucionTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;
  return (
    <div className="tooltip-grafico tooltip-grafico-ancha">
      <p className="tooltip-titulo">{fila.label}</p>
      <div className="tooltip-lista-cifras">
        {EJECUCION_SERIES.map((serie) => (
          <p className="tooltip-dato" key={serie.clave}>
            <span>
              <span className="tooltip-muestra" style={{ backgroundColor: serie.color }} />
              {serie.label}
            </span>
            <span className="tooltip-dato-valor">
              {formatNumber(fila[serie.clave])}
              <span className="tooltip-porcentaje">{formatPercentReal(fila[serie.pct], 1)}</span>
            </span>
          </p>
        ))}
        <p className="tooltip-dato">
          <span>Cuentas exigibles</span>
          <span className="tooltip-dato-valor">{formatNumber(fila.exigibles)}</span>
        </p>
      </div>
      <p className="tooltip-pista">La barra reparte el 100% de las cuentas exigibles al corte.</p>
    </div>
  );
}

/**
 * Barras apiladas al 100%: cómo se compone el proceso de cobro de cada
 * secretaría (completadas, en proceso, devueltas y en mora).
 */
export function EjecucionSecretariasBars({ data, height = 260 }) {
  return (
    <div className="pila-bloque">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dfe6ea" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            width={150}
            tickFormatter={(value) => truncate(value, 22)}
          />
          <Tooltip
            cursor={{ fill: '#eef3f7' }}
            content={<EjecucionTooltip />}
            wrapperStyle={estiloTooltipDentroDeGrafica({ anchoEje: 150, margenIzquierda: 4, margenDerecha: 24 })}
          />
          {EJECUCION_SERIES.map((serie, index) => (
            <Bar
              key={serie.clave}
              dataKey={serie.pct}
              name={serie.label}
              stackId="ejecucion"
              fill={serie.color}
              maxBarSize={26}
              radius={index === EJECUCION_SERIES.length - 1 ? [0, 6, 6, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="leyenda-cuentas">
        {EJECUCION_SERIES.map((serie) => (
          <span className="leyenda-item" key={serie.clave}>
            <span className="leyenda-muestra" style={{ backgroundColor: serie.color }} />
            {serie.label}
          </span>
        ))}
      </div>
    </div>
  );
}
