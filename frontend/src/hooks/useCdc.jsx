import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resolveCdcUrl } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
const CdcContext = createContext(null);
const MAX_EVENTS = 150;
const MAX_RETRY_DELAY = 15_000;
function isCdcEvent(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.tipo === 'string' &&
        typeof candidate.contrato === 'string' &&
        typeof candidate.tabla === 'string' &&
        typeof candidate.timestamp === 'number' &&
        typeof candidate.estado === 'object' &&
        candidate.estado !== null);
}
function numero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function texto(value) {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function cuentaConEstado(cuenta, estado) {
    const idEstado = numero(estado.id_estado) ?? cuenta.idEstadoActual;
    const nombre = texto(estado.estado) ?? cuenta.estadoActual;
    const fecha = texto(estado.fecha_estado);
    const descripcion = texto(estado.detalle_estado);
    const paso = { idEstado, estado: nombre, fecha, descripcion };
    const pasos = cuenta.pasos.slice();
    const ultimo = pasos[pasos.length - 1];
    if (ultimo && ultimo.idEstado === idEstado) {
        pasos[pasos.length - 1] = paso;
    }
    else {
        pasos.push(paso);
    }
    return {
        ...cuenta,
        idEstadoActual: idEstado,
        estadoActual: nombre,
        fechaEstado: fecha ?? cuenta.fechaEstado,
        descripcionEstado: descripcion ?? cuenta.descripcionEstado,
        siguientePaso: texto(estado.siguiente_paso) ?? cuenta.siguientePaso,
        pasos,
    };
}
function cuentaDesdeInforme(cuentas, estado) {
    const id = numero(estado.id_informe_actividad);
    if (id === null || id <= 0)
        return { cuentas, agregada: false };
    const index = cuentas.findIndex((item) => item.idInformeActividad === id);
    if (index >= 0) {
        const actual = cuentas[index];
        const copy = cuentas.slice();
        copy[index] = {
            ...actual,
            noInforme: numero(estado.no_informe) ?? actual.noInforme,
            numInforme: texto(estado.num_informe) ?? actual.numInforme,
            tipoInforme: texto(estado.tipo_informe) ?? actual.tipoInforme,
            requiereSecop: typeof estado.requiere_secop === 'boolean' ? estado.requiere_secop : actual.requiereSecop,
            firmado: typeof estado.informe_firmado === 'boolean' ? estado.informe_firmado : actual.firmado,
            fechaInicio: texto(estado.informe_desde) ?? actual.fechaInicio,
            fechaFin: texto(estado.informe_hasta) ?? actual.fechaFin,
        };
        return { cuentas: copy, agregada: false };
    }
    const nueva = {
        idInformeActividad: id,
        noInforme: numero(estado.no_informe),
        numInforme: texto(estado.num_informe),
        tipoInforme: texto(estado.tipo_informe),
        requiereSecop: estado.requiere_secop === true,
        firmado: estado.informe_firmado === true,
        fechaInicio: texto(estado.informe_desde),
        fechaFin: texto(estado.informe_hasta),
        idEstadoActual: 1,
        estadoActual: 'Registrando',
        fechaEstado: null,
        descripcionEstado: null,
        siguientePaso: 'Enviar informe de actividades a revisión',
        activa: true,
        pasos: [{ idEstado: 1, estado: 'Registrando', fecha: null, descripcion: null }],
    };
    return {
        cuentas: [...cuentas.map((item) => ({ ...item, activa: false })), nueva],
        agregada: true,
    };
}
function mergeCuentas(cuentas, event) {
    const estado = event.estado;
    let resultado = cuentas;
    if (estado.cuentas_cobro?.length) {
        resultado = resultado.map((cuenta) => {
            const live = estado.cuentas_cobro?.find((item) => item.id_informe_actividad === cuenta.idInformeActividad);
            if (!live || live.id_estado === cuenta.idEstadoActual)
                return cuenta;
            return {
                ...cuenta,
                idEstadoActual: live.id_estado,
                estadoActual: live.estado || cuenta.estadoActual,
            };
        });
    }
    if (event.tabla.includes('ct_t_trazabilidad')) {
        const idCuenta = numero(estado.cuenta_cobro_actual);
        if (idCuenta !== null) {
            if (!resultado.some((cuenta) => cuenta.idInformeActividad === idCuenta)) {
                const idEstado = numero(estado.id_estado) ?? 1;
                resultado = [
                    ...resultado.map((cuenta) => ({ ...cuenta, activa: false })),
                    {
                        idInformeActividad: idCuenta,
                        noInforme: null,
                        numInforme: null,
                        tipoInforme: null,
                        requiereSecop: false,
                        firmado: false,
                        fechaInicio: null,
                        fechaFin: null,
                        idEstadoActual: idEstado,
                        estadoActual: texto(estado.estado),
                        fechaEstado: null,
                        descripcionEstado: null,
                        siguientePaso: texto(estado.siguiente_paso),
                        activa: true,
                        pasos: [],
                    },
                ];
            }
            resultado = resultado.map((cuenta) => {
                if (cuenta.idInformeActividad === idCuenta) {
                    return { ...cuentaConEstado(cuenta, estado), activa: true };
                }
                return cuenta.activa ? { ...cuenta, activa: false } : cuenta;
            });
        }
    }
    return resultado;
}
function mergeLiveState(contratos, event) {
    if (!contratos)
        return contratos;
    const index = contratos.findIndex((contrato) => contrato.noContrato === event.contrato);
    if (index === -1)
        return contratos;
    const estado = event.estado;
    const current = contratos[index];
    const updated = { ...current };
    if (typeof estado.id_estado === 'number')
        updated.idEstadoActual = estado.id_estado;
    if (typeof estado.estado === 'string')
        updated.estadoActual = estado.estado;
    if (typeof estado.porcentaje_avance === 'number') {
        updated.avanceDeclarado = Math.min(100, Math.max(0, estado.porcentaje_avance));
    }
    if (typeof estado.ultima_supervision === 'number' &&
        estado.ultima_supervision > updated.totalSupervisiones) {
        updated.totalSupervisiones = estado.ultima_supervision;
    }
    if (typeof estado.detalle_estado === 'string')
        updated.descripcion = estado.detalle_estado;
    if (typeof estado.siguiente_paso === 'string')
        updated.siguientePaso = estado.siguiente_paso;
    if (typeof estado.fecha_estado === 'string')
        updated.fechaEstado = estado.fecha_estado;
    if (typeof estado.en_firme === 'boolean' && estado.en_firme)
        updated.informeCargado = true;
    const detallePrevio = current.cuentasDetalle ?? [];
    let detalle = detallePrevio;
    let agregoInforme = false;
    if (event.tabla.includes('ct_t_informe_actividades')) {
        const informe = cuentaDesdeInforme(detalle, estado);
        detalle = informe.cuentas;
        agregoInforme = informe.agregada;
    }
    if (event.tabla.includes('ct_t_trazabilidad')) {
        detalle = mergeCuentas(detalle, event);
    }
    if (detalle !== detallePrevio || agregoInforme) {
        updated.cuentasDetalle = detalle;
        if (agregoInforme) {
            updated.cuentasRegistradas = current.cuentasRegistradas + 1;
            updated.informeCargado = true;
        }
    }
    // El avance solo queda certificado cuando el contratista ha radicado una cuenta.
    const declarado = updated.avanceDeclarado ?? current.avanceDeclarado ?? 0;
    updated.avanceDeclarado = declarado;
    updated.porcentajeAvance = (updated.cuentasRegistradas ?? 0) > 0 ? declarado : 0;
    const copy = contratos.slice();
    copy[index] = updated;
    return copy;
}
export function CdcProvider({ children }) {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState('connecting');
    const [events, setEvents] = useState([]);
    const [lastEvent, setLastEvent] = useState(null);
    const [paused, setPaused] = useState(false);
    const [generation, setGeneration] = useState(0);
    const pausedRef = useRef(paused);
    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);
    useEffect(() => {
        let socket = null;
        let retry = 0;
        let retryTimer;
        let closedByEffect = false;
        const url = resolveCdcUrl();
        const connect = () => {
            if (closedByEffect)
                return;
            setStatus('connecting');
            try {
                socket = new WebSocket(url);
            }
            catch {
                scheduleReconnect();
                return;
            }
            socket.onopen = () => {
                retry = 0;
                setStatus('connected');
            };
            socket.onmessage = (message) => {
                try {
                    const parsed = JSON.parse(message.data);
                    if (!isCdcEvent(parsed))
                        return;
                    setLastEvent(parsed);
                    if (!pausedRef.current) {
                        setEvents((previous) => [parsed, ...previous].slice(0, MAX_EVENTS));
                    }
                    queryClient.setQueryData(queryKeys.contratos, (previous) => mergeLiveState(previous, parsed));
                }
                catch {
                    // Ignore malformed frames: the socket must stay open.
                }
            };
            socket.onerror = () => {
                socket?.close();
            };
            socket.onclose = () => {
                if (closedByEffect)
                    return;
                setStatus('disconnected');
                scheduleReconnect();
            };
        };
        const scheduleReconnect = () => {
            const delay = Math.min(1_000 * 2 ** retry, MAX_RETRY_DELAY);
            retry += 1;
            retryTimer = window.setTimeout(connect, delay);
        };
        connect();
        return () => {
            closedByEffect = true;
            if (retryTimer !== undefined)
                window.clearTimeout(retryTimer);
            socket?.close();
        };
    }, [generation, queryClient]);
    const clearEvents = useCallback(() => setEvents([]), []);
    const reconnect = useCallback(() => setGeneration((value) => value + 1), []);
    const url = useMemo(() => resolveCdcUrl(), []);
    const value = useMemo(() => ({
        status,
        url,
        events,
        lastEvent,
        paused,
        setPaused,
        clearEvents,
        reconnect,
    }), [status, url, events, lastEvent, paused, clearEvents, reconnect]);
    return <CdcContext.Provider value={value}>{children}</CdcContext.Provider>;
}
export function useCdc() {
    const context = useContext(CdcContext);
    if (!context) {
        throw new Error('useCdc debe usarse dentro de CdcProvider');
    }
    return context;
}
