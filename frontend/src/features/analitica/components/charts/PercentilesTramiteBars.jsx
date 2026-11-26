import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/features/analitica/components/charts/ChartTooltip';
import { estiloTooltipDentroDeGrafica } from '@/features/analitica/components/charts/estiloTooltipDentroDeGrafica';
import { formatNumber, truncate } from '@/shared/utils';

// Nadie en la secretaria lee "P50" ni "P90". Las dos barras se llaman por lo que
// significan: lo que tarda un tramite corriente y lo que tarda uno de los que se atrasan.
export const PERCENTILES_SERIES = [
  {
    clave: 'p50',
    label: 'Trámite típico',
    glosa: 'La mitad de las cuentas cierra en esto o menos',
    color: '#17699b',
  },
  {
    clave: 'p90',
    label: 'Trámite lento',
    glosa: '9 de cada 10 cierran antes de esto',
    color: '#a16207',
  },
];

function PercentilesTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const fila = payload[0]?.payload;
  if (!fila) return null;
  const brecha = Math.max(0, (fila.p90 ?? 0) - (fila.p50 ?? 0));
  // El doble de dias que el tramite corriente ya no es una cifra suelta: es un atasco.
  const atrasado = Number(fila.p50) > 0 && (fila.p90 ?? 0) >= fila.p50 * 2;
  return (
    <div className="tooltip-grafico tooltip-grafico-ancha">
      <p className="tooltip-titulo">{fila.label}</p>
      <div className="tooltip-lista-cifras">
        {PERCENTILES_SERIES.map((serie) => (
          <div className="tooltip-dato-bloque" key={serie.clave}>
            <p className="tooltip-dato">
              <span>
                <span className="tooltip-muestra" style={{ backgroundColor: serie.color }} />
                {serie.label}
              </span>
              <span className="tooltip-dato-valor">{formatNumber(fila[serie.clave])} d</span>
            </p>
            <p className="tooltip-pista">{serie.glosa}</p>
          </div>
        ))}
        <p className="tooltip-dato">
          <span>Cuentas medidas</span>
          <span className="tooltip-dato-valor">{formatNumber(fila.cuentas)}</span>
        </p>
      </div>
      <p className={`tooltip-veredicto ${atrasado ? 'tooltip-veredicto-malo' : 'tooltip-veredicto-bueno'}`}>
        {brecha < 1
          ? 'Casi no hay diferencia: las cuentas cierran en tiempos parecidos.'
          : `Las cuentas lentas tardan ${formatNumber(Math.round(brecha * 10) / 10)} días más que lo normal.`}
      </p>
    </div>
  );
}

/**
 * Barras agrupadas de dias de tramite: lo que cierra la mitad de las cuentas frente a
 * lo que tardan las que se atrasan. El tooltip lleva el tope de ancho de la grafica
 * para que recharts pueda voltearlo de lado y no se salga de la tarjeta.
 */
export function PercentilesTramiteBars({ data, height = 240 }) {
  return (
    <div className="pila-bloque">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 0 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dfe6ea" />
          <XAxis type="number" unit=" d" tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false} />
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
            content={<PercentilesTooltip />}
            wrapperStyle={estiloTooltipDentroDeGrafica({ anchoEje: 150, margenIzquierda: 4, margenDerecha: 34 })}
          />
          {PERCENTILES_SERIES.map((serie) => (
            <Bar
              key={serie.clave}
              dataKey={serie.clave}
              name={serie.label}
              fill={serie.color}
              maxBarSize={16}
              radius={[0, 4, 4, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="leyenda-cuentas">
        {PERCENTILES_SERIES.map((serie) => (
          <span className="leyenda-item" key={serie.clave}>
            <span className="leyenda-muestra" style={{ backgroundColor: serie.color }} />
            {serie.label}
          </span>
        ))}
      </div>
    </div>
  );
}
