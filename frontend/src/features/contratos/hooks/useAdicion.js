import { useQuery } from '@tanstack/react-query';
import { fetchAdicionContrato } from '@/features/contratos/api/contratos';
import { ApiError, queryKeys } from '@/shared/services';

export function useAdicion(noContrato) {
    return useQuery({
        queryKey: queryKeys.adicion(noContrato ?? ''),
        queryFn: async () => {
            try {
                return await fetchAdicionContrato(noContrato);
            }
            catch (error) {
                if (error instanceof ApiError && error.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        enabled: Boolean(noContrato),
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
