import { useQuery } from '@tanstack/react-query';
import { fetchCalificacionRiesgo } from '@/features/contratos/api/contratos';
import { queryKeys } from '@/shared/services';

export function useCalificacionRiesgo() {
    return useQuery({
        queryKey: queryKeys.calificacionRiesgo,
        queryFn: fetchCalificacionRiesgo,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
