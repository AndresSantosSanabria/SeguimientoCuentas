import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { appConfig } from '@/app/config/env';

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

/**
 * Aviso de "sesion cerrada" compartido entre pestanas.
 *
 * El token vive en sessionStorage, que es por pestana: al duplicar una pestana
 * el navegador copia el token y la otra sigue funcionando aunque el usuario
 * haya cerrado sesion en una de ellas. Para que el cierre alcance a todas, se
 * difunde una marca en localStorage (compartido) que cada pestana escucha.
 */
const BUS_LOGOUT = 'gecor:sesion:logout';
const EVENTO_SESION_CERRADA = 'gecor:sesion-cerrada';
/** La sesion de ESTA pestana esta cerrada (no se vuelve a entrar solo). */
let sesionCerrada = false;

function cacheUser(user) {
  cachedAccessToken = user?.access_token ?? null;
  cachedExpiresAt = user?.expires_at ?? 0;
  if (user) sesionCerrada = false;
}

/** ¿La sesion de esta pestana quedo cerrada? */
export function sesionCerradaAhora() {
  return sesionCerrada;
}

function tokenPorVencer() {
  return cachedExpiresAt > 0 && cachedExpiresAt * 1000 <= Date.now() + 30_000;
}

/** Momento (epoch ms) en que se cerro la sesion por ultima vez. */
function leerMarcaLogout() {
  try {
    return Number(globalThis.localStorage?.getItem(BUS_LOGOUT) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Difunde el cierre de sesion: a esta pestana por evento y a las demas por
 * localStorage (el evento "storage" solo lo reciben las otras pestanas).
 */
export function broadcastLogout() {
  const marca = Date.now();
  sesionCerrada = true;
  try {
    globalThis.localStorage?.setItem(BUS_LOGOUT, String(marca));
  } catch {
    // Sin almacenamiento disponible el cierre solo alcanza a esta pestana.
  }
  globalThis.dispatchEvent(new CustomEvent(EVENTO_SESION_CERRADA, { detail: { marca } }));
}

/** Se suscribe al cierre de sesion, propio o de otra pestana. */
export function onSesionCerrada(handler) {
  const local = (event) => handler(event.detail?.marca ?? Date.now());
  const storage = (event) => {
    if (event.key !== BUS_LOGOUT || !event.newValue) return;
    handler(Number(event.newValue) || Date.now());
  };
  globalThis.addEventListener(EVENTO_SESION_CERRADA, local);
  globalThis.addEventListener('storage', storage);
  return () => {
    globalThis.removeEventListener(EVENTO_SESION_CERRADA, local);
    globalThis.removeEventListener('storage', storage);
  };
}

/**
 * El token fue emitido antes del ultimo cierre de sesion: la pestana quedo con
 * una copia (pestana duplicada) de una sesion que ya no existe.
 */
function tokenPrevioAlCierre(token) {
  if (!token) return false;
  const emitida = Number(decodeJwtPayload(token)?.iat ?? 0) * 1000;
  const cerrada = leerMarcaLogout();
  return emitida > 0 && cerrada > 0 && cerrada > emitida;
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
 *
 * Si el token guardado es de una sesion que ya se cerro en otra pestana
 * (pestana duplicada), se descarta: esa copia no vuelve a dar acceso.
 */
export async function initAuth() {
  if (!auth) return null;
  const user = await auth.getUser();
  if (user && tokenPrevioAlCierre(user.access_token)) {
    await cerrarSesionLocal();
    return null;
  }
  cacheUser(user);
  return user;
}

/** Hubo un cierre de sesion hace poco (se muestra la pantalla de sesion cerrada). */
export function logoutReciente(ventanaMs = 10 * 60 * 1000) {
  const marca = leerMarcaLogout();
  return marca > 0 && Date.now() - marca < ventanaMs;
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
    // Si Keycloak ya no reconoce la sesion, la renovacion no va a volver a
    // funcionar: se cierra la sesion en vez de dejar un token muerto en cache.
    if (sesionPerdida(error)) {
      cerrarSesionLocal();
      broadcastLogout();
    }
    return null;
  }
}

/** Keycloak dice que la sesion ya no existe (no es un fallo de red). */
function sesionPerdida(error) {
  const texto = `${error?.error ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return ['login_required', 'invalid_grant', 'not_logged_in', 'session_expired', 'invalid_token']
    .some((clave) => texto.includes(clave));
}

/** Cierra la sesion SOLO en esta pestana (no vuelve a difundir el aviso). */
export async function cerrarSesionLocal() {
  if (!auth) return;
  sesionCerrada = true;
  try {
    await auth.removeUser();
    await auth.clearStaleState();
  } catch (error) {
    console.warn('No se pudo limpiar el estado OIDC local:', error);
  }
  cacheUser(null);
}

/**
 * Cierra la sesion: difunde el aviso a las demas pestanas, termina la sesion
 * de Keycloak y devuelve al usuario a la app.
 *
 * La sesion del IdP se cierra con un iframe oculto que llama al
 * "end_session_endpoint" con el id_token_hint. Asi no depende de que el
 * "post_logout_redirect_uri" este registrado en el cliente de Keycloak (si no
 * lo esta, la redireccion deja al usuario en una pagina de error y la sesion
 * sigue viva en el navegador).
 */
export async function startLogoutRedirect() {
  if (!auth) return null;
  let idToken = null;
  try {
    const user = await auth.getUser();
    idToken = user?.id_token ?? null;
  } catch {
    // Sin usuario local: se cierra igual la sesion global.
  }
  await cerrarSesionLocal();
  // Las demas pestanas (incluidas las duplicadas) pierden el acceso ya mismo.
  broadcastLogout();
  if (idToken) {
    terminarSesionKeycloak(idToken);
  }
  const postLogout = appConfig.keycloak.postLogoutRedirectUri;
  globalThis.location.assign(postLogout);
  return null;
}

/** Pide a Keycloak que termine la sesion del usuario (front-channel logout). */
function terminarSesionKeycloak(idToken) {
  const endpoint = `${appConfig.keycloak.authority}/protocol/openid-connect/logout`;
  const url = `${endpoint}?id_token_hint=${encodeURIComponent(idToken)}&client_id=${encodeURIComponent(appConfig.keycloak.clientId)}`;
  try {
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.style.display = 'none';
    marco.src = url;
    document.body.appendChild(marco);
    // El marco se retira solo: no hace falta esperar la respuesta.
    globalThis.setTimeout(() => marco.remove(), 5_000);
  } catch (error) {
    console.warn('No se pudo pedir el cierre de sesion en Keycloak:', error);
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
