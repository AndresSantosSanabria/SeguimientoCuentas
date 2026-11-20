export const queryKeys = {
    contratos: ['contratos'],
    reporte: (noContrato) => ['contratos', noContrato, 'reporte'],
    valorContrato: (noContrato) => ['contratos', noContrato, 'valor'],
    adicion: (noContrato) => ['contratos', noContrato, 'adicion'],
    calificacionRiesgo: ['contratos', 'calificacion-riesgo'],
    sesion: ['sesion'],
    accesos: {
        usuarios: ['accesos', 'usuarios'],
        roles: ['accesos', 'roles'],
        permisos: ['accesos', 'permisos'],
    },
};
