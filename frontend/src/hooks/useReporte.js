import { useQuery } from '@tanstack/react-query';
import { fetchReporteContrato } from '@/api/contratos';
import { queryKeys } from '@/api/queryKeys';
export function useReporte(noContrato) {
    return useQuery({
        queryKey: queryKeys.reporte(noContrato ?? ''),
        queryFn: () => fetchReporteContrato(noContrato),
        enabled: Boolean(noContrato),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
