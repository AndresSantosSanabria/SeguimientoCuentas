import { estadoLabel, estadoTone } from '@/lib/estados';

export function EstadoBadge({ id, label, className = '' }) {
  const tone = estadoTone(id);
  return (
    <span data-tone={tone} className={`estado-badge ${className}`} title={estadoLabel(id, label)}>
      <span className="estado-badge-punto" />
      <span className="estado-badge-texto">{estadoLabel(id, label)}</span>
    </span>
  );
}
