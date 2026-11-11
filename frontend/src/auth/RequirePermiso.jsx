import { LogoApp } from '@/components/ui/LogoApp';
import { useAuth } from '@/context/AuthContext';

/**
 * Ruta que exige un permiso: sin el, la persona vuelve al listado de contratos.
 * Mientras se consulta la sesion no se decide nada: se espera, para no expulsar
 * a alguien de una pantalla que si puede ver.
 */
export function RequirePermiso({ permiso, children }) {
  const { puede, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return (
      <div className="carga-ruta">
        <LogoApp />
        <span className="spinner" role="status" aria-label="Verificando permisos" />
      </div>
    );
  }
  if (!puede(permiso)) {
    return (
      <main className="pila-pagina" role="alert">
        <h1>Acceso no habilitado</h1>
        <p>Tu cuenta todavía no tiene permiso para ver esta sección.</p>
      </main>
    );
  }
  return children;
}
