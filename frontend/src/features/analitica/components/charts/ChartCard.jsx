import { Card, CardHeader } from '@/shared/components/ui';

/**
 * Tarjeta de sección del sistema Bento: encabezado con contador en badge gris
 * y cuerpo sin bordes pesados.
 */
export function ChartCard({ title, subtitle, action, contador, children, className = '', bodyClassName = '', footer }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} contador={contador} />
      <div className={`grafico-cuerpo ${bodyClassName}`}>{children}</div>
      {footer ? <div className="grafico-pie">{footer}</div> : null}
    </Card>
  );
}
