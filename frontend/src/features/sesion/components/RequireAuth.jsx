import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { LogoApp } from '@/shared/components/ui';
import { useAuth } from '@/features/sesion/components/AuthProvider';

/**
 * Ruta protegida: si no hay sesion, Keycloak redirige el navegador al login
 * (donde el realm exige el doble factor). Con auth apagada deja pasar todo.
 *
 * Cuando la sesion se cerro (en esta pestana o en otra), NO se entra solo:
 * se muestra la pantalla de sesion cerrada y el usuario decide cuando volver
 * a entrar. Asi una pestana duplicada no se queda operando con una copia vieja
 * del token.
 */
export function RequireAuth() {
  const { enabled, ready, user, login, sesionCerrada } = useAuth();

  useEffect(() => {
    if (enabled && ready && !user && !sesionCerrada) {
      login();
    }
  }, [enabled, ready, user, login, sesionCerrada]);

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
  if (sesionCerrada && !user) {
    return (
      <div className="auth-redirigiendo" role="alert">
        <LogoApp />
        <h1>Sesion cerrada</h1>
        <p>Tu sesion se cerro, tambien en las demas pestanas abiertas de GE-COR.</p>
        <button type="button" className="btn btn-primary" onClick={() => login()}>
          <LogOut />
          Iniciar sesion de nuevo
        </button>
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
