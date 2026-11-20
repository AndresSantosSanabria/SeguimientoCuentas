export function dependenciaLabel(contrato) {
    const registrada = contrato.dependencia?.trim();
    if (registrada)
        return registrada;
    const codigo = contrato.noContrato?.split('-')[0]?.trim().toUpperCase();
    return codigo || 'Sin dependencia';
}
