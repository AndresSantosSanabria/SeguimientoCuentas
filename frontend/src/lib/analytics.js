import { ESTADOS_RECHAZO, ESTADO_DEVOLUCION, estadoLabel, } from '@/lib/estados';
import { diffInDays, parseDateOnly } from '@/lib/format';
import { dependenciaLabel } from '@/lib/dependencias';
const AVANCE_LABELS = [
    'Sin supervisión',
    '0 – 20%',
    '21 – 40%',
    '41 – 60%',
    '61 – 80%',
    '81 – 100%',
];
const VENCIMIENTO_LABELS = [
    'Vencidos',
    '0 – 30 días',
    '31 – 60 días',
    '61 – 90 días',
    'Más de 90 días',
];
const ANIO_MIN = 1900;
const ANIO_MAX = 2100;
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function topWithOthers(buckets, limit, othersLabel = 'Otros') {
    const sorted = [...buckets].sort((a, b) => b.value - a.value);
    if (sorted.length <= limit)
        return sorted;
    const top = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    top.push({
        label: othersLabel,
        value: rest.reduce((sum, item) => sum + item.value, 0),
    });
    return top;
}
export function computeAnalytics(contratos) {
    const kpis = {
        totalContratos: 0,
        avancePromedio: 0,
        conSupervision: 0,
        informesCargados: 0,
    };
    const estadoMap = new Map();
    const avanceCounts = AVANCE_LABELS.map(() => 0);
    const dependenciaMap = new Map();
    const anioMap = new Map();
    const vencimientoCounts = VENCIMIENTO_LABELS.map(() => 0);
    let supervisionados = 0;
    let sumaAvance = 0;
    let sumaAvanceSupervisados = 0;
    let rechazados = 0;
    let devueltos = 0;
    let sinInforme = 0;
    let porVencer30 = 0;
    let sinSupervision = 0;
    let fechasInvalidas = 0;
    let fechasFueraDeRango = 0;
    let cuentasRegistradas = 0;
    let cuentasEsperadas = 0;
    let cuentasExigibles = 0;
    let cuentasEnMora = 0;
    let contratosEnMora = 0;
    let contratosAlDia = 0;
    const today = new Date();
    for (const contrato of contratos) {
        const avance = Math.min(100, Math.max(0, num(contrato.porcentajeAvance)));
        const estadoId = contrato.idEstadoActual ?? 0;
        const supervisiones = num(contrato.totalSupervisiones);
        kpis.totalContratos += 1;
        if (supervisiones > 0) {
            kpis.conSupervision += 1;
            supervisionados += 1;
            sumaAvanceSupervisados += avance;
        }
        else {
            sinSupervision += 1;
        }
        if (contrato.informeCargado)
            kpis.informesCargados += 1;
        sumaAvance += avance;
        const estado = estadoMap.get(estadoId) ?? {
            label: estadoLabel(estadoId, contrato.estadoActual),
            value: 0,
        };
        estado.value += 1;
        estadoMap.set(estadoId, estado);
        const avanceIndex = supervisiones === 0 ? 0 : 1 + Math.min(4, Math.floor(avance / 20));
        avanceCounts[avanceIndex] += 1;
        const dependencia = dependenciaLabel(contrato);
        dependenciaMap.set(dependencia, (dependenciaMap.get(dependencia) ?? 0) + 1);
        let fechaInvalida = false;
        let fechaFueraDeRango = false;
        const inicio = parseDateOnly(contrato.fechaInicio);
        if (contrato.fechaInicio && !inicio) {
            fechaInvalida = true;
        }
        else if (inicio) {
            const anio = inicio.getFullYear();
            if (anio < ANIO_MIN || anio > ANIO_MAX) {
                fechaFueraDeRango = true;
            }
            else {
                anioMap.set(anio, (anioMap.get(anio) ?? 0) + 1);
            }
        }
        const fin = parseDateOnly(contrato.fechaFin);
        if (contrato.fechaFin && !fin) {
            fechaInvalida = true;
        }
        else if (fin) {
            const anio = fin.getFullYear();
            if (anio < ANIO_MIN || anio > ANIO_MAX) {
                fechaFueraDeRango = true;
            }
            else {
                const dias = diffInDays(today, fin);
                if (dias < 0) {
                    vencimientoCounts[0] += 1;
                }
                else if (dias <= 30) {
                    vencimientoCounts[1] += 1;
                    porVencer30 += 1;
                }
                else if (dias <= 60) {
                    vencimientoCounts[2] += 1;
                }
                else if (dias <= 90) {
                    vencimientoCounts[3] += 1;
                }
                else {
                    vencimientoCounts[4] += 1;
                }
            }
        }
        if (fechaInvalida)
            fechasInvalidas += 1;
        else if (fechaFueraDeRango)
            fechasFueraDeRango += 1;
        if (ESTADOS_RECHAZO.has(estadoId))
            rechazados += 1;
        if (estadoId === ESTADO_DEVOLUCION)
            devueltos += 1;
        if (supervisiones > 0 && !contrato.informeCargado)
            sinInforme += 1;
        const mora = num(contrato.cuentasEnMora);
        cuentasRegistradas += num(contrato.cuentasRegistradas);
        cuentasEsperadas += num(contrato.cuentasEsperadas);
        cuentasExigibles += num(contrato.cuentasExigibles);
        cuentasEnMora += mora;
        if (mora > 0)
            contratosEnMora += 1;
        else if (num(contrato.cuentasExigibles) > 0)
            contratosAlDia += 1;
    }
    const estados = [...estadoMap.entries()]
        .map(([id, entry]) => ({ id, label: entry.label, value: entry.value }))
        .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const avances = AVANCE_LABELS.map((label, index) => ({
        label,
        value: avanceCounts[index],
    }));
    const dependencias = topWithOthers([...dependenciaMap.entries()].map(([label, value]) => ({ label, value })), 8);
    const anios = [...anioMap.entries()]
        .map(([anio, value]) => ({ label: String(anio), value }))
        .sort((a, b) => Number(a.label) - Number(b.label));
    const vencimientos = VENCIMIENTO_LABELS.map((label, index) => ({
        label,
        value: vencimientoCounts[index],
    }));
    const promedioSupervisiones = supervisionados > 0
        ? contratos.reduce((sum, c) => sum + num(c.totalSupervisiones), 0) / supervisionados
        : 0;
    const alertas = [
        {
            id: 'rechazados',
            label: 'Informes rechazados',
            value: rechazados,
            description: 'Contratos detenidos por rechazo del supervisor o de SECOP.',
            tone: rechazados > 0 ? 'danger' : 'info',
            href: '/contratos?alerta=rechazados',
        },
        {
            id: 'devueltos',
            label: 'Informes devueltos',
            value: devueltos,
            description: 'Informes devueltos al contratista para corrección.',
            tone: devueltos > 0 ? 'warning' : 'info',
            href: '/contratos?alerta=devueltos',
        },
        {
            id: 'cuentas-en-mora',
            label: 'Cuentas en mora',
            value: contratosEnMora,
            description: 'Contratos con cuentas de cobro pendientes frente a las exigibles por mes.',
            tone: contratosEnMora > 0 ? 'danger' : 'info',
            href: '/contratos?alerta=mora',
        },
        {
            id: 'sin-informe',
            label: 'Informe pendiente',
            value: sinInforme,
            description: 'Contratos con supervisión registrada pero sin informe cargado.',
            tone: sinInforme > 0 ? 'warning' : 'info',
            href: '/contratos?alerta=sin-informe',
        },
        {
            id: 'por-vencer',
            label: 'Vencen en 30 días',
            value: porVencer30,
            description: 'Contratos cuya fecha de terminación está próxima.',
            tone: porVencer30 > 0 ? 'danger' : 'info',
            href: '/contratos?alerta=por-vencer',
        },
        {
            id: 'sin-supervision',
            label: 'Sin supervisiones',
            value: sinSupervision,
            description: 'Contratos sin ningún registro de supervisión.',
            tone: 'info',
            href: '/contratos?alerta=sin-supervision',
        },
    ];
    return {
        kpis: {
            ...kpis,
            avancePromedio: kpis.totalContratos > 0 ? Math.round((sumaAvance / kpis.totalContratos) * 10) / 10 : 0,
        },
        estados,
        avances,
        dependencias,
        vencimientos,
        anios,
        supervision: {
            conSupervision: supervisionados,
            sinSupervision,
            cobertura: kpis.totalContratos > 0 ? (supervisionados / kpis.totalContratos) * 100 : 0,
            promedioSupervisiones: Math.round(promedioSupervisiones * 10) / 10,
            promedioAvanceSupervisados: supervisionados > 0 ? Math.round((sumaAvanceSupervisados / supervisionados) * 10) / 10 : 0,
        },
        calidad: {
            fechasInvalidas,
            fechasFueraDeRango,
            vencidos: vencimientoCounts[0],
        },
        cuentas: {
            registradas: cuentasRegistradas,
            esperadas: cuentasEsperadas,
            exigibles: cuentasExigibles,
            enMora: cuentasEnMora,
            contratosEnMora,
            contratosAlDia,
            cobertura: cuentasExigibles > 0 ? (cuentasRegistradas / cuentasExigibles) * 100 : 0,
        },
        alertas,
    };
}
