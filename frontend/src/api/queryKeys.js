export const queryKeys = {
    contratos: ['contratos'],
    reporte: (noContrato) => ['contratos', noContrato, 'reporte'],
    valorContrato: (noContrato) => ['contratos', noContrato, 'valor'],
    sesion: ['sesion'],
    accesos: {
        usuarios: ['accesos', 'usuarios'],
        roles: ['accesos', 'roles'],
        permisos: ['accesos', 'permisos'],
    },
};
