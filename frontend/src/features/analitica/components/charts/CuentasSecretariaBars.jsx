import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { AXIS_TICK, ChartTooltip } from '@/features/analitica/components/charts/ChartTooltip';
import { estiloTooltipDentroDeGrafica } from '@/features/analitica/components/charts/estiloTooltipDentroDeGrafica';
export const CUENTAS_COLORS = {
    completadas: '#17699b',
    pendientes: '#b3261e',
};
export function CuentasSecretariaBars({ data, height = 300 }) {
    return (<ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dfe6ea"/>
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false}/>
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} width={150}/>
        <Tooltip
          cursor={{ fill: '#eef3f7' }}
          content={<ChartTooltip />}
          wrapperStyle={estiloTooltipDentroDeGrafica({ anchoEje: 150, margenIzquierda: 4, margenDerecha: 20 })}
        />
        <Bar dataKey="completadas" name="Completadas" stackId="cuentas" fill={CUENTAS_COLORS.completadas} maxBarSize={18}/>
        <Bar dataKey="pendientes" name="Pendientes" stackId="cuentas" fill={CUENTAS_COLORS.pendientes} radius={[0, 6, 6, 0]} maxBarSize={18}/>
      </BarChart>
    </ResponsiveContainer>);
}
