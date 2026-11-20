import { useMemo } from 'react';
import { computeAnalytics } from '@/features/analitica/utils/analytics';
export function useContractAnalytics(contratos) {
    return useMemo(() => (contratos ? computeAnalytics(contratos) : null), [contratos]);
}
