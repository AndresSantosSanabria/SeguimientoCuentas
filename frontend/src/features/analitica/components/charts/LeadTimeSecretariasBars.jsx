import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_TICK } from '@/features/analitica/components/charts/ChartTooltip';
import { estiloTooltipDentroDeGrafica } from '@/features/analitica/components/charts/estiloTooltipDentroDeGrafica';
import { ETAPAS, formatDuracion } from '@/features/analitica/utils/leadTime';
import { formatNumber, formatPercentReal, truncate } from '@/shared/utils';

function LeadTimeSecretariasTooltip({ active, payload }) {
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
          <span>Lead Time por cuenta</span>
          <span className="tooltip-dato-valor">{formatDuracion(fila.total)}</span>
        </p>
      </div>
      <p className="tooltip-veredicto tooltip-veredicto-malo">
        {formatPercentReal(fila.total > 0 ? (muertos / fila.total) * 100 : 0, 1)} del tiempo es muerto ·{' '}
        {formatNumber(fila.cuentas)} {fila.cuentas === 1 ? 'cuenta' : 'cuentas'} · acumulado{' '}
        {formatDuracion(fila.acumulado)}
      </p>
      <p className="tooltip-pista">Promedio por cuenta: permite comparar secretarías de tamaños distintos.</p>
    </div>
  );
}

/**
 * Barras apiladas del lead time por secretaría: cada barra es el promedio de
 * días que una cuenta pasa en cada etapa, separando tiempo de valor (procesamiento
 * y entrega) de tiempo muerto (recepción/aprobación y cola).
 */
export function LeadTimeSecretariasBars({ data, height = 240 }) {
  // La escala sigue la magnitud del dato: con lapsos de minutos leer «0 d» no sirve.
  const maximo = data.reduce((max, fila) => Math.max(max, fila.total), 0);
  const escala = maximo >= 1
    ? { unit: ' d', tick: (value) => String(value) }
    : maximo >= 1 / 24
      ? { unit: ' h', tick: (value) => String(Math.round(value * 24 * 10) / 10).replace('.', ',') }
      : { unit: ' min', tick: (value) => String(Math.round(value * 1440)) };
  return (
    <div className="pila-bloque">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dfe6ea" />
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
            width={150}
            tickFormatter={(value) => truncate(value, 22)}
          />
          <Tooltip
            cursor={{ fill: '#eef3f7' }}
            content={<LeadTimeSecretariasTooltip />}
            wrapperStyle={estiloTooltipDentroDeGrafica({ anchoEje: 150, margenIzquierda: 4, margenDerecha: 34 })}
          />
          {ETAPAS.map((etapa, index) => (
            <Bar
              key={etapa.id}
              dataKey={etapa.id}
              name={etapa.label}
              stackId="etapas"
              fill={etapa.color}
              maxBarSize={26}
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
            <span className="texto-apoyo">({etapa.tipo === 'valor' ? 'con valor' : 'muerto'})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
