const RAW_API_BASE = import.meta.env.VITE_API_URL ?? '';
const API_BASE = RAW_API_BASE.replace(/\/$/, '');
export class ApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
async function request(path) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            headers: { Accept: 'application/json, text/plain' },
        });
    }
    catch {
        throw new ApiError('No fue posible conectar con el backend. Verifica que el servicio esté disponible.', 0);
    }
    if (!response.ok) {
        throw new ApiError(`El backend respondió con estado ${response.status}.`, response.status);
    }
    return response;
}
export async function getJson(path) {
    const response = await request(path);
    return (await response.json());
}
export async function getText(path) {
    const response = await request(path);
    return response.text();
}
export function resolveCdcUrl() {
    if (RAW_API_BASE) {
        return `${RAW_API_BASE.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/cdc`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/cdc`;
}
