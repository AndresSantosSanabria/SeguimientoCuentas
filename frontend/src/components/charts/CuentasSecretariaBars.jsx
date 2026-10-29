import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { AXIS_TICK, ChartTooltip } from '@/components/charts/ChartTooltip';
export const CUENTAS_COLORS = {
    completadas: '#1e7fd8',
    pendientes: '#e11d48',
};
export function CuentasSecretariaBars({ data, height = 300 }) {
    return (<ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} allowDecimals={false}/>
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} width={150}/>
        <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip />}/>
        <Bar dataKey="completadas" name="Completadas" stackId="cuentas" fill={CUENTAS_COLORS.completadas} maxBarSize={18}/>
        <Bar dataKey="pendientes" name="Pendientes" stackId="cuentas" fill={CUENTAS_COLORS.pendientes} radius={[0, 6, 6, 0]} maxBarSize={18}/>
      </BarChart>
    </ResponsiveContainer>);
}
