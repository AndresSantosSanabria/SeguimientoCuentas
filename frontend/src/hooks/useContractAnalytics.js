import { useMemo } from 'react';
import { computeAnalytics } from '@/lib/analytics';
export function useContractAnalytics(contratos) {
    return useMemo(() => (contratos ? computeAnalytics(contratos) : null), [contratos]);
}
