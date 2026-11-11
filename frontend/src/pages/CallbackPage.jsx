import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoApp } from '@/components/ui/LogoApp';
import { appConfig } from '@/config/env';
import { auth, clearOidcStaleState } from '@/utils/auth';

const CALLBACK_TIMEOUT_MS = 12000;

/**
 * Destino seguro tras el callback: solo rutas internas de esta aplicacion
 * (evita open redirect si Keycloak o un tercero mandan una URL externa en state).
 */
function safeReturnUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/callback')) {
    return '/';
  }
  return value;
}

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const handledRef = useRef(false);

  useEffect(() => {
    // StrictMode monta/desmonta el efecto en dev: sin esta guardia el segundo
    // run saldria por handledRef y el usuario quedaria eternamente cargando.
    if (handledRef.current) {
      return undefined;
    }
    handledRef.current = true;

    const go = (returnUrl) => navigate(safeReturnUrl(returnUrl), { replace: true });

    // Debe estar declarado ANTES de usarse: en un modulo ES (modo estricto) una
    // asignacion sin declarar lanza ReferenceError y deja la pagina en el spinner.
    let timeoutId = null;

    const clearTimer = () => {
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    /**
     * CWE-598: el authorization code y el state no deben quedarse en la barra
     * de direcciones (historial, Referer, capturas). Se limpia SIEMPRE despues
     * de que oidc-client-ts procese la respuesta, nunca antes.
     */
    const purgeOidcParams = () => {
      try {
        if (globalThis.location.search) {
          globalThis.history.replaceState(null, '', globalThis.location.pathname);
        }
      } catch {
        // noop: si history no esta disponible, la navegacion posterior lo limpia.
      }
    };

    const params = new URLSearchParams(globalThis.location.search);
    const hasOidcResponse =
      params.has('code') || params.has('id_token') || params.has('error') || params.has('error_description');

    const manejarCallback = async () => {
      // Renovacion silenciosa: el navegador nos trajo aqui dentro de un iframe
      // oculto. Solo hay que devolver la respuesta al padre, sin navegar.
      if (globalThis.self !== globalThis.top) {
        try {
          await auth?.signinSilentCallback();
        } catch (err) {
          console.warn('signinSilentCallback fallo:', err);
        }
        return;
      }

      // Sin respuesta OIDC (refresh o acceso directo a /callback): no llamar
      // signinRedirectCallback, puede colgarse sin code/state.
      if (!hasOidcResponse) {
        try {
          const user = await auth?.getUser();
          go(user?.state);
        } catch {
          go('/');
        }
        return;
      }

      timeoutId = globalThis.setTimeout(() => {
        console.warn('[CallbackPage] signinRedirectCallback excedio el timeout');
        clearTimer();
        purgeOidcParams();
        setError('La autenticacion tardo demasiado. Regresando al inicio...');
        clearOidcStaleState().finally(() => go('/'));
      }, CALLBACK_TIMEOUT_MS);

      try {
        const user = await auth?.signinRedirectCallback();
        clearTimer();
        purgeOidcParams();
        go(user?.state);
      } catch (err) {
        console.error('Error procesando callback de OIDC:', err);
        clearTimer();
        purgeOidcParams();
        setError('Fallo la autenticacion. Regresando al inicio...');
        clearOidcStaleState().finally(() => go('/'));
      }
    };

    // Si algo inesperado falla fuera de los try/catch internos, se reporta y se
    // regresa al inicio en vez de quedarse en el spinner para siempre.
    manejarCallback().catch((err) => {
      console.error('Callback inesperado:', err);
      clearTimer();
      purgeOidcParams();
      setError('Fallo inesperado al procesar el login. Regresando al inicio...');
      clearOidcStaleState().finally(() => go('/'));
    });

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  if (!appConfig.enableAuth) {
    return null;
  }

  return (
    <div className="auth-callback">
      <LogoApp />
      {error ? <h2 className="auth-callback-error">{error}</h2> : <h2>Iniciando sesion segura…</h2>}
      <span className="spinner" role="status" aria-label="Cargando" />
    </div>
  );
}
