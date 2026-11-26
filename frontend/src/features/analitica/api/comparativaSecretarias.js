import { getJson } from '@/shared/services';

/**
 * La comparativa entre secretarías la arma el backend sobre el índice en memoria:
 * aquí solo se piden los agregados con el mismo período y alcance de la página.
 */
export function fetchComparativaSecretarias({ anios = [], desde = '', hasta = '', alcance = 'curso', ops = 'todas' } = {}) {
    const params = new URLSearchParams();
    if (anios.length > 0) params.set('anios', anios.join(','));
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    params.set('alcance', alcance);
    if (ops && ops !== 'todas') params.set('ops', ops);
    return getJson(`/api/analitica/comparacion-secretarias?${params.toString()}`);
}
