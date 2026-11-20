import { getJson } from '@/shared/services';

/**
 * Lo que el backend sabe de la persona conectada: rol, permisos y secretarias.
 * Es el unico lugar donde el frontend pregunta que puede hacer.
 */
export function fetchSesion() {
    return getJson('/api/sesion');
}
