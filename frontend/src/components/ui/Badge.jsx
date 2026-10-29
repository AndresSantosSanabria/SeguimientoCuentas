export function Badge({ tone = 'neutral', children, dot = false, className = '' }) {
  return (
    <span data-tone={tone} className={`badge ${className}`}>
      {dot ? <span className="badge-punto" /> : null}
      {children}
    </span>
  );
}
