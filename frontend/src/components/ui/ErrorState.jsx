import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({
  title = 'No fue posible cargar la información',
  message = 'Revisa la conexión con el backend e inténtalo de nuevo.',
  onRetry,
}) {
  return (
    <div className="estado-centrado estado-error">
      <span className="icono-globo icono-globo-estado">
        <AlertTriangle />
      </span>
      <p className="estado-titulo">{title}</p>
      <p className="estado-detalle">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-ghost estado-accion" onClick={onRetry}>
          <RefreshCw />
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
