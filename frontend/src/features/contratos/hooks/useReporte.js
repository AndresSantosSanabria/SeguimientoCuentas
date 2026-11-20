import { useQuery } from '@tanstack/react-query';
import { fetchReporteContrato, fetchValorContrato } from '@/features/contratos/api/contratos';
import { queryKeys } from '@/shared/services';
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

export function useValorContrato(noContrato) {
    return useQuery({
        queryKey: queryKeys.valorContrato(noContrato ?? ''),
        queryFn: () => fetchValorContrato(noContrato),
        enabled: Boolean(noContrato),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });
}
