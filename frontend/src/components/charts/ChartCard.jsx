import { Card, CardHeader } from '@/components/ui/Card';

export function ChartCard({ title, subtitle, action, children, className = '', bodyClassName = '', footer }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className={`grafico-cuerpo ${bodyClassName}`}>{children}</div>
      {footer ? <div className="grafico-pie">{footer}</div> : null}
    </Card>
  );
}
