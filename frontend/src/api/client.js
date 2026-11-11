import { appConfig } from '@/config/env';
import { getAccessTokenSync, renewAccessToken, startLoginRedirect } from '@/utils/auth';

const RAW_API_BASE = appConfig.apiUrl;
const API_BASE = RAW_API_BASE.replace(/\/$/, '');
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
/** Cabecera Authorization cuando la autenticacion esta encendida. */
function authHeaders() {
    const token = appConfig.enableAuth ? getAccessTokenSync() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
}
/** Evita varias peticiones disparando el redirect al login a la vez. */
let reLoginEnCurso = false;
function redirectToLogin() {
    if (reLoginEnCurso)
        return;
    reLoginEnCurso = true;
    startLoginRedirect(`${globalThis.location.pathname}${globalThis.location.search}`);
}
async function request(path, init = {}, { reintento = true } = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...init,
            headers: { Accept: 'application/json, text/plain', ...authHeaders(), ...(init.headers ?? {}) },
        });
    }
    catch {
        throw new ApiError('No fue posible conectar con el backend. Verifica que el servicio estǸ disponible.', 0);
    }
    // 401 = token vencido o revocado: se renueva una vez (refresh_token) y se reintenta.
    // Si la renovacion no es posible, Keycloak revalida la sesion SSO con un redirect.
    if (response.status === 401 && appConfig.enableAuth && reintento) {
        const renovado = await renewAccessToken();
        if (renovado) {
            return request(path, init, { reintento: false });
        }
        redirectToLogin();
        throw new ApiError('La sesion expiro. Redirigiendo al login…', 401);
    }
    if (!response.ok) {
        throw new ApiError(`El backend respondi�� con estado ${response.status}.`, response.status);
    }
    return response;
}
export async function getJson(path) {
    const response = await request(path);
    return (await response.json());
}
export async function putJson(path, body) {
    const response = await request(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    if (response.status === 204) {
        return null;
    }
    return response.json();
}
export async function getText(path) {
    const response = await request(path);
    return response.text();
}
export function resolveCdcUrl() {
    const base = RAW_API_BASE
        ? `${RAW_API_BASE.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/cdc`
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/cdc`;
    // El navegador no puede mandar cabeceras en un WebSocket: el token viaja como
    // query param y lo valida el backend en el handshake.
    const token = appConfig.enableAuth ? getAccessTokenSync({ renovarSiExpira: true }) : null;
    // Sin sesion se devuelve la URL sin token y sin llamar a Keycloak: el backend
    // responde 401 y el hook reintenta cuando ya haya un token cacheado.
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
