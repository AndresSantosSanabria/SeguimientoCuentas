import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LogoApp } from '@/components/ui/LogoApp';
import { useAuth } from '@/context/AuthContext';

/**
 * Ruta protegida: si no hay sesion, Keycloak redirige el navegador al login
 * (donde el realm exige el doble factor). Con auth apagada deja pasar todo.
 */
export function RequireAuth() {
  const { enabled, ready, user, login } = useAuth();

  useEffect(() => {
    if (enabled && ready && !user) {
      login();
    }
  }, [enabled, ready, user, login]);

  if (!enabled) {
    return <Outlet />;
  }
  if (!ready) {
    return (
      <div className="carga-ruta">
        <LogoApp />
        <span className="spinner" role="status" aria-label="Verificando sesion" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="auth-redirigiendo">
        <LogoApp />
        <span className="spinner" role="status" aria-label="Iniciando sesion" />
        <p>Redirigiendo al login seguro de Keycloak…</p>
        <button type="button" className="btn btn-primary" onClick={() => login()}>
          Ir al inicio de sesion
        </button>
      </div>
    );
  }
  return <Outlet />;
}
