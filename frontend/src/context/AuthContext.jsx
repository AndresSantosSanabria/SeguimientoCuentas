/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appConfig } from '@/config/env';
import { useSesion } from '@/hooks/useSesion';
import { extractRolesFromToken, initAuth, startLoginRedirect, startLogoutRedirect } from '@/utils/auth';

const AuthContext = createContext(null);

/** Nombre visible del usuario segun lo que traiga Keycloak. */
function nombreDe(user) {
  const profile = user?.profile ?? {};
  return (
    [profile.name, [profile.given_name, profile.family_name].filter(Boolean).join(' '), profile.preferred_username, profile.email, profile.sub]
      .map((value) => String(value || '').trim())
      .find(Boolean) || 'Usuario'
  );
}

export function AuthProvider({ children }) {
  // enabled solo si esta encendido en .env Y tiene los datos del realm completos.
  const enabled = appConfig.enableAuth;
  const configurado = appConfig.keycloak.configured;
  const [ready, setReady] = useState(!enabled);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!enabled || !configurado) {
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await initAuth();
        if (!cancelled) setUser(current);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, configurado]);

  // Rol, permisos y secretarias: los dice el backend, que es donde viven en GECOR.
  const conSesion = enabled && configurado && ready && Boolean(user);
  const { data: sesion, isLoading: cargandoSesion, isError: errorSesion } = useSesion({ enabled: conSesion });

  const login = useCallback((returnUrl) => {
    const destino =
      returnUrl ??
      `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
    return startLoginRedirect(destino);
  }, []);

  const logout = useCallback(() => startLogoutRedirect(), []);

  const puede = useCallback(
    (permiso) => {
      if (!enabled) return true;
      // Sin respuesta del backend no hay autorización verificable: cerrar el acceso.
      if (errorSesion) return false;
      if (!sesion) return false;
      return sesion.permisos?.includes('*') || sesion.permisos?.includes(permiso) === true;
    },
    [enabled, errorSesion, sesion],
  );

  const value = useMemo(
    () => ({
      enabled: enabled && configurado,
      ready,
      user,
      nombre: user ? nombreDe(user) : '',
      correo: String(user?.profile?.email || ''),
      roles: user ? extractRolesFromToken(user.access_token) : [],
      sesion: sesion ?? null,
      rol: sesion?.rol ?? null,
      permisos: sesion?.permisos ?? [],
      secretarias: sesion?.secretarias ?? [],
      verTodasSecretarias: sesion?.verTodasSecretarias === true,
      cargandoSesion,
      puede,
      login,
      logout,
    }),
    [enabled, configurado, ready, user, sesion, cargandoSesion, puede, login, logout],
  );

  // Config incompleta: se avisa en pantalla en vez de dejar la app en blanco.
  if (enabled && !configurado) {
    return (
      <div className="auth-falta-config" role="alert">
        <h1>Falta la configuracion de Keycloak</h1>
        <p>
          La autenticacion esta encendida (<code>VITE_ENABLE_AUTH=true</code>) pero faltan datos del
          realm. Revisa las variables <code>VITE_KEYCLOAK_*</code> en el archivo <code>.env</code> y
          reinicia el contenedor del frontend.
        </p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
