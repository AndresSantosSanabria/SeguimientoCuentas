/**
 * Contratos OPS: se reconocen por la tercera sigla del número (formato STD-CD-XXX-...).
 * Cuando esa sigla es PSA o PSP, el contrato es una OPS; cualquier otra sigla no lo es.
 */
const SIGLAS_OPS = new Set(['psa', 'psp']);

export function esOps(noContrato) {
  const sigla = String(noContrato ?? '').split('-')[2]?.trim().toLowerCase();
  return Boolean(sigla) && SIGLAS_OPS.has(sigla);
}

export function contratoEsOps(contrato) {
  return esOps(contrato?.noContrato);
}

/** Predicado de filtro por tipo OPS: 'ops' = solo OPS, 'no-ops' = sin OPS, otro valor = no recorta. */
export function contratoEnOps(contrato, valor) {
  if (valor === 'ops') return contratoEsOps(contrato);
  if (valor === 'no-ops') return !contratoEsOps(contrato);
  return true;
}

export const OPCIONES_OPS = [
  { value: 'todas', label: 'Todos los tipos' },
  { value: 'ops', label: 'Solo OPS' },
  { value: 'no-ops', label: 'Sin OPS' },
];
