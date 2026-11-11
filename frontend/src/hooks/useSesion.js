import { useQuery } from '@tanstack/react-query';
import { fetchSesion } from '@/api/sesion';
import { queryKeys } from '@/api/queryKeys';

export function useSesion({ enabled = true } = {}) {
    return useQuery({
        queryKey: queryKeys.sesion,
        queryFn: fetchSesion,
        enabled,
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 0,
    });
}
