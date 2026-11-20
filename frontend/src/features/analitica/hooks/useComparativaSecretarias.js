import { useQuery } from '@tanstack/react-query';
import { fetchComparativaSecretarias } from '@/features/analitica/api/comparativaSecretarias';

export function useComparativaSecretarias({ anios = [], desde = '', hasta = '', alcance = 'curso' } = {}) {
    return useQuery({
        queryKey: ['analitica', 'comparacion-secretarias', anios.join(','), desde, hasta, alcance],
        queryFn: () => fetchComparativaSecretarias({ anios, desde, hasta, alcance }),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
