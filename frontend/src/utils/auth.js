import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { appConfig } from '@/config/env';

const { authority, clientId, redirectUri, postLogoutRedirectUri, responseType, scope } =
  appConfig.keycloak;

/**
 * Endpoints del realm construidos a partir de la autoridad configurada.
 * Se declaran explicitos para no depender de la ronda de descubrimiento OIDC
 * en cada arranque (Keycloak los publica exactamente con esta forma).
 *
 * El token_endpoint apunta al proxy same-origin (/oidc/token): el navegador no
 * puede publicar directamente contra Keycloak porque ese endpoint valida el
 * cabecera Origin de forma literal contra "Web origins" del client (ver
 * deploy/nginx.conf). Los demas endpoints son navegaciones de nivel superior,
 * que no envian cabecera Origin, asi que van directos al realm.
 */
const metadata = authority
  ? {
      issuer: authority,
      authorization_endpoint: `${authority}/protocol/openid-connect/auth`,
      token_endpoint: appConfig.keycloak.tokenEndpoint || `${authority}/protocol/openid-connect/token`,
      end_session_endpoint: `${authority}/protocol/openid-connect/logout`,
      jwks_uri: `${authority}/protocol/openid-connect/certs`,
      userinfo_endpoint: `${authority}/protocol/openid-connect/userinfo`,
    }
  : undefined;

export const auth = appConfig.keycloak.configured
  ? new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      response_type: responseType,
      scope,
      // Authorization Code + PKCE: la libreria siempre manda code_challenge S256
      // (el client "ge-cor" es publico, no hay secreto que exponer en el navegador).
      automaticSilentRenew: true,
      monitorSession: false,
      loadUserInfo: false,
      filterProtocolClaims: true,
      // CWE-922: los tokens se guardan en sessionStorage (no localStorage) para que
      // se borren al cerrar el navegador y la ventana de ataque XSS no persista.
      userStore: new WebStorageStateStore({ store: globalThis.sessionStorage }),
      metadata,
    })
  : null;

/** Token en memoria: lo usan el wrapper del API y la URL del WebSocket CDC. */
let cachedAccessToken = null;
/** expires_at (epoch segundos) del token cacheado; 0 = desconocido. */
let cachedExpiresAt = 0;

function cacheUser(user) {
  cachedAccessToken = user?.access_token ?? null;
  cachedExpiresAt = user?.expires_at ?? 0;
}

function tokenPorVencer() {
  return cachedExpiresAt > 0 && cachedExpiresAt * 1000 <= Date.now() + 30_000;
}

if (auth) {
  auth.events.addUserLoaded(cacheUser);
  auth.events.addUserSignedOut(() => cacheUser(null));
  auth.events.addAccessTokenExpired(() => {
    cachedAccessToken = null;
  });
}

/**
 * Token actual sin esperas (null si auth esta apagado o no hay sesion).
 * Con `renovarSiExpira`, si el token esta por vencer se renueva en segundo
 * plano: la conexion actual sigue con el token viejo hasta la proxima
 * reconexion. Sin sesion NO se intenta nada (evita bucles contra Keycloak).
 */
export function getAccessTokenSync({ renovarSiExpira = false } = {}) {
  if (!cachedAccessToken) return null;
  if (renovarSiExpira && tokenPorVencer()) {
    renewAccessToken();
  }
  return cachedAccessToken;
}

/** Limpia estados OIDC viejos que dejó un cierre de pestana abrupto. */
export async function clearOidcStaleState() {
  if (!auth) return;
  try {
    await auth.clearStaleState();
  } catch (error) {
    console.warn('No fue posible limpiar el estado OIDC previo al login:', error);
  }
}

/**
 * Carga la sesion existente al arrancar la app y deja el token cacheado.
 * Devuelve el usuario (o null si no hay sesion / auth apagado).
 */
export async function initAuth() {
  if (!auth) return null;
  const user = await auth.getUser();
  cacheUser(user);
  return user;
}

/** Redirige al login de Keycloak guardando a donde queria ir el usuario. */
export async function startLoginRedirect(returnUrl) {
  if (!auth) return;
  await clearOidcStaleState();
  let next = typeof returnUrl === 'string' && returnUrl.trim() !== '' ? returnUrl : '/';
  if (next === '/callback' || next.startsWith('/callback?')) {
    next = '/';
  }
  return auth.signinRedirect({ state: next });
}

/**
 * Renueva el access token con el refresh_token (o por iframe si no lo hay).
 * Si falla devuelve null y el llamador decide (reintento 401 o login).
 */
export async function renewAccessToken() {
  if (!auth) return null;
  try {
    // Sin sesion guardada no hay nada que renovar: sin este guardia
    // signinSilent intentaria el flujo por iframe en cada reintento.
    const stored = await auth.getUser();
    if (!stored) return null;
    const user = await auth.signinSilent();
    cacheUser(user);
    return user?.access_token ?? null;
  } catch (error) {
    console.warn('No fue posible renovar el token de Keycloak:', error);
    return null;
  }
}

/** Cierra la sesion local y redirige al logout de Keycloak (SSO). */
export async function startLogoutRedirect() {
  if (!auth) return;
  let idToken = null;
  try {
    const user = await auth.getUser();
    idToken = user?.id_token ?? null;
  } catch {
    // Sin usuario local: se cierra igual la sesion global.
  }
  try {
    await auth.removeUser();
    await auth.clearStaleState();
  } catch (error) {
    console.warn('No se pudo limpiar el estado OIDC antes del logout:', error);
  }
  const postLogout = appConfig.keycloak.postLogoutRedirectUri;
  try {
    return await auth.signoutRedirect({
      id_token_hint: idToken,
      post_logout_redirect_uri: postLogout,
    });
  } catch (error) {
    console.warn('No se pudo cerrar la sesion en Keycloak, forzando retorno:', error);
    globalThis.location.assign(postLogout);
    return null;
  }
}

/** Decodifica el payload de un JWT sin verificar firma (solo para mostrar datos). */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return {};
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const normalized = payload.replaceAll(/-/g, '+').replaceAll(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded));
  } catch (error) {
    console.error('Error decodificando JWT de Keycloak:', error);
    return {};
  }
}

/** Roles del realm y del client, para mostrar permisos o filtrar vistas. */
export function extractRolesFromToken(token) {
  const payload = decodeJwtPayload(token);
  const roles = new Set();
  const realmRoles = payload?.realm_access?.roles;
  if (Array.isArray(realmRoles)) realmRoles.forEach((role) => roles.add(role));
  const resourceRoles = payload?.resource_access?.[clientId]?.roles;
  if (Array.isArray(resourceRoles)) resourceRoles.forEach((role) => roles.add(role));
  return Array.from(roles);
}
