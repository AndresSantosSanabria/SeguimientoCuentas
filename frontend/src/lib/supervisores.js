import { dependenciaLabel } from '@/lib/dependencias';
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
export function buildContratosPorSupervisor(contratos, { secretaria = '', limite = 12 } = {}) {
    const porSupervisor = new Map();
    let contratosConSupervisor = 0;
    for (const contrato of contratos) {
        const nombre = contrato.supervisor?.trim();
        if (!nombre)
            continue;
        if (secretaria && dependenciaLabel(contrato) !== secretaria)
            continue;
        contratosConSupervisor += 1;
        const entrada = porSupervisor.get(nombre) ?? {
            label: nombre,
            value: 0,
            alDia: 0,
            represadas: 0,
            exigibles: 0,
            radicadas: 0,
            contratos: [],
        };
        entrada.value += 1;
        entrada.alDia += cuentasAlDia(contrato);
        entrada.represadas += cuentasRepresadas(contrato);
        entrada.exigibles += num(contrato.cuentasExigibles);
        entrada.radicadas += num(contrato.cuentasRegistradas);
        entrada.contratos.push(contrato);
        porSupervisor.set(nombre, entrada);
    }
    const ordenados = [...porSupervisor.values()]
        .map((entrada) => ({
            ...entrada,
            contratos: [...entrada.contratos].sort((a, b) => (cuentasRepresadas(b) - cuentasRepresadas(a)) ||
                String(a.contratista ?? '').localeCompare(String(b.contratista ?? ''), 'es')),
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
    return {
        rows: ordenados.slice(0, limite),
        supervisores: ordenados.length,
        contratos: contratosConSupervisor,
        alDia: ordenados.reduce((sum, entrada) => sum + entrada.alDia, 0),
        represadas: ordenados.reduce((sum, entrada) => sum + entrada.represadas, 0),
        ocultos: Math.max(0, ordenados.length - limite),
        maximo: ordenados[0]?.value ?? 0,
        promedio: ordenados.length > 0 ? contratosConSupervisor / ordenados.length : 0,
    };
}
