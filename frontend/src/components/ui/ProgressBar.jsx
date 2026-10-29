import { clamp, formatPercent } from '@/lib/format';

function resolveTone(value) {
  if (value >= 80) return 'success';
  if (value >= 50) return 'sky';
  if (value >= 25) return 'warning';
  return 'danger';
}

export function ProgressBar({ value, tone = 'auto', showLabel = false, className = '', size = 'md' }) {
  const safeValue = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const resolved = tone === 'auto' ? resolveTone(safeValue) : tone;
  return (
    <div className={`progreso ${className}`}>
      <div
        className={size === 'sm' ? 'progreso-pista progreso-pista-corta' : 'progreso-pista'}
        role="progressbar"
        aria-valuenow={Math.round(safeValue)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div data-tone={resolved} className="progreso-barra" style={{ width: `${safeValue}%` }} />
      </div>
      {showLabel ? <span className="progreso-etiqueta">{formatPercent(safeValue, 0)}</span> : null}
    </div>
  );
}
