import { useQuery } from '@tanstack/react-query';
import { fetchComparativaSecretarias } from '@/features/analitica/api/comparativaSecretarias';

export function useComparativaSecretarias({ anios = [], desde = '', hasta = '', alcance = 'curso', ops = 'todas' } = {}) {
    return useQuery({
        queryKey: ['analitica', 'comparacion-secretarias', anios.join(','), desde, hasta, alcance, ops],
        queryFn: () => fetchComparativaSecretarias({ anios, desde, hasta, alcance, ops }),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
