import { dependenciaLabel } from '@/lib/dependencias';
import { pasaSecretaria } from '@/lib/cuentasSecretaria';
import { normalizar } from '@/lib/format';
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
/** Cuentas radicadas dentro de las exigidas a la fecha. Lo que se pase se considera anticipado, no moroso. */
export function cuentasAlDia(contrato) {
    return Math.min(num(contrato.cuentasRegistradas), num(contrato.cuentasExigibles));
}
export function cuentasRepresadas(contrato) {
    return num(contrato.cuentasEnMora);
}
/**
 * Carga por supervisor. El filtro de secretaría admite varias; la búsqueda reduce
 * lo que se dibuja, pero los totales del pie siempre describen el universo filtrado.
 */
export function buildContratosPorSupervisor(contratos, { secretarias = [], secretaria = '', busqueda = '', limite = 12, limiteBusqueda = 25 } = {}) {
    const filtros = { secretarias, secretaria };
    const termino = normalizar(busqueda);
    const porSupervisor = new Map();
    let contratosConSupervisor = 0;
    for (const contrato of contratos) {
        const nombre = contrato.supervisor?.trim();
        if (!nombre)
            continue;
        if (!pasaSecretaria(dependenciaLabel(contrato), filtros))
            continue;
        contratosConSupervisor += 1;
        const entrada = porSupervisor.get(nombre) ?? {
            label: nombre,
            value: 0,
            alDia: 0,
            represadas: 0,
            exigibles: 0,
            radicadas: 0,
            secretarias: new Set(),
            contratos: [],
        };
        entrada.value += 1;
        entrada.alDia += cuentasAlDia(contrato);
        entrada.represadas += cuentasRepresadas(contrato);
        entrada.exigibles += num(contrato.cuentasExigibles);
        entrada.radicadas += num(contrato.cuentasRegistradas);
        entrada.secretarias.add(dependenciaLabel(contrato));
        entrada.contratos.push(contrato);
        porSupervisor.set(nombre, entrada);
    }
    const ordenados = [...porSupervisor.values()]
        .map((entrada) => ({
            ...entrada,
            secretarias: [...entrada.secretarias].sort((a, b) => a.localeCompare(b, 'es')),
            contratos: [...entrada.contratos].sort((a, b) => (cuentasRepresadas(b) - cuentasRepresadas(a)) ||
                String(a.contratista ?? '').localeCompare(String(b.contratista ?? ''), 'es')),
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
    const coincidencias = termino
        ? ordenados.filter((entrada) => normalizar(entrada.label).includes(termino))
        : ordenados;
    const tope = termino ? limiteBusqueda : limite;
    return {
        rows: coincidencias.slice(0, tope),
        todos: ordenados,
        coincidencias,
        supervisores: ordenados.length,
        contratos: contratosConSupervisor,
        alDia: ordenados.reduce((sum, entrada) => sum + entrada.alDia, 0),
        represadas: ordenados.reduce((sum, entrada) => sum + entrada.represadas, 0),
        ocultos: Math.max(0, coincidencias.length - tope),
        maximo: ordenados[0]?.value ?? 0,
        promedio: ordenados.length > 0 ? contratosConSupervisor / ordenados.length : 0,
    };
}
