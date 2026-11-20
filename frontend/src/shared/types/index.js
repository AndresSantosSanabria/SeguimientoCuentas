/**
 * Tipos globales del dominio, documentados con JSDoc para que el editor los
 * ofrezca sin necesidad de TypeScript. La forma real la fija el backend.
 */

/**
 * @typedef {Object} ContratoResumen
 * @property {string} noContrato
 * @property {string} contratista
 * @property {string} [supervisor]
 * @property {string} [secretaria]
 * @property {number} [valorTotal]
 * @property {string} [fechaInicio]
 * @property {string} [fechaFin]
 * @property {number} [supervisiones]
 * @property {number} [avance]
 * @property {number} [idEstadoActual]
 * @property {string} [estadoActual]
 * @property {boolean} [informeCargado]
 */

/**
 * @typedef {Object} CuentaCobro
 * @property {number} [idInformeActividad]
 * @property {string} [noContrato]
 * @property {number} [idEstadoActual]
 * @property {string} [estadoActual]
 * @property {string} [fechaEstado]
 * @property {string} [descripcionEstado]
 * @property {string} [siguientePaso]
 * @property {string} [responsableActual]
 * @property {string} [rolResponsableActual]
 * @property {Array<Object>} [pasos]
 */

/**
 * @typedef {Object} PasoEstado
 * @property {number} idEstado
 * @property {string} estado
 * @property {string|null} fecha
 * @property {string|null} descripcion
 * @property {string|null} usuario
 */

/**
 * @typedef {Object} Supervisor
 * @property {string} nombre
 * @property {number} contratos
 * @property {number} cuentasAlDia
 * @property {number} cuentasRepresadas
 */

/**
 * @typedef {Object} SesionUsuario
 * @property {boolean} enabled
 * @property {boolean} ready
 * @property {Object|null} user
 * @property {string} nombre
 * @property {string} correo
 * @property {string[]} roles
 * @property {string[]} permisos
 * @property {string[]} secretarias
 * @property {boolean} verTodasSecretarias
 * @property {Object|null} rol
 */

/**
 * @typedef {Object} EventoCdc
 * @property {string} tipo
 * @property {string} contrato
 * @property {string} tabla
 * @property {number} timestamp
 * @property {Object} estado
 */

export {};
