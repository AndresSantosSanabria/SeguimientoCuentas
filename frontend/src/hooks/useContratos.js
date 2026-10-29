import { useQuery } from '@tanstack/react-query';
import { fetchContratos } from '@/api/contratos';
import { queryKeys } from '@/api/queryKeys';
export function useContratos() {
    return useQuery({
        queryKey: queryKeys.contratos,
        queryFn: fetchContratos,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
