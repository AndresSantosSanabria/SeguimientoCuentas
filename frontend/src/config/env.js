/**
 * Configuracion central de la aplicacion.
 *
 * Jerarquia de resolucion (de mayor a menor prioridad):
 *  1. window.__APP_CONFIG__  -> inyectado en runtime por /config.js (contenedor Docker).
 *  2. import.meta.env.VITE_*  -> horneado por Vite en build (util en dev local o como
 *     fallback si el contenedor no inyecto config).
 *  3. Derivada de window.location -> cuando una URL no esta configurada en ningun
 *     origen, se calcula desde el punto de montaje real en el navegador.
 *
 * Asi la misma imagen Docker sirve cualquier entorno (dev, QA, prod) sin reconstruir
 * ni contener URLs quemadas de localhost.
 */

const runtimeConfig =
  (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

const readValue = (key) => {
  // 1) Runtime: claves planas en config.js (KEYCLOAK_REALM, API_URL, ...)
  const runtimeKey = key.replace(/^VITE_/, '');
  const runtimeValue = runtimeConfig[runtimeKey];
  if (
    runtimeValue !== undefined &&
    runtimeValue !== null &&
    runtimeValue.toString().trim() !== ''
  ) {
    return runtimeValue.toString().trim();
  }

  // 2) Build-time (import.meta.env de Vite)
  const buildValue = import.meta.env[key];
  if (
    buildValue !== undefined &&
    buildValue !== null &&
    buildValue.toString().trim() !== ''
  ) {
    return buildValue.toString().trim();
  }

  return null;
};

const optionalEnv = (key, fallback = '') => readValue(key) ?? fallback;

/** Origen real del navegador: se usa como fallback de redirect/logout. */
const currentOrigin =
  typeof window !== 'undefined' ? window.location.origin : '';

/**
 * URL publica del API.
 * Vacio (por defecto) = mismo origen: el nginx del frontend hace proxy de /api/
 * hacia el backend, asi que no hay CORS ni URL absoluta que configurar.
 */
const resolveApiUrl = () => (readValue('VITE_API_URL') || '').replace(/\/+$/, '');

/** URL de retorno tras el login en Keycloak. */
const resolveRedirectUri = () =>
  readValue('VITE_KEYCLOAK_REDIRECT_URI') || `${currentOrigin}/callback`;

/** URL de retorno tras cerrar sesion en Keycloak. */
const resolvePostLogoutRedirectUri = () =>
  readValue('VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI') || `${currentOrigin}/`;

const keycloakBaseUrl = (readValue('VITE_KEYCLOAK_BASE_URL') || '').replace(/\/+$/, '');
const keycloakRealm = readValue('VITE_KEYCLOAK_REALM') || '';
const keycloakClientId = readValue('VITE_KEYCLOAK_CLIENT_ID') || '';

/**
 * Endpoint de intercambio de codigo por token.
 * Por defecto vive en NUESTRO mismo origen (/oidc/token, ver deploy/nginx.conf):
 * el /token de Keycloak exige un Origin literal igual al "Web origins" del
 * client, regla que el navegador no puede cumplir. Con el mismo origen no hay
 * CORS y nginx reenvia la peticion sin cabecera Origin.
 */
const resolveTokenEndpoint = () =>
  readValue('VITE_KEYCLOAK_TOKEN_ENDPOINT') || (currentOrigin ? `${currentOrigin}/oidc/token` : '');

export const appConfig = {
  apiUrl: resolveApiUrl(),
  enableAuth: optionalEnv('VITE_ENABLE_AUTH', 'true') === 'true',
  keycloak: {
    /** false = faltan datos de Keycloak: la UI lo avisa en vez de fallar en blanco. */
    configured: Boolean(keycloakBaseUrl && keycloakRealm && keycloakClientId),
    baseUrl: keycloakBaseUrl,
    realm: keycloakRealm,
    authority: keycloakBaseUrl && keycloakRealm ? `${keycloakBaseUrl}/realms/${keycloakRealm}` : '',
    clientId: keycloakClientId,
    tokenEndpoint: resolveTokenEndpoint(),
    redirectUri: resolveRedirectUri(),
    postLogoutRedirectUri: resolvePostLogoutRedirectUri(),
    responseType: optionalEnv('VITE_KEYCLOAK_RESPONSE_TYPE', 'code'),
    scope: optionalEnv('VITE_KEYCLOAK_SCOPE', 'openid profile email'),
  },
};
