import { ArrowUpRight, ClipboardCheck, ClipboardList, Download, FileCheck2, Radio, RefreshCw, Search, TrendingUp, Users, Wifi, WifiOff, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChartCard } from '@/components/charts/ChartCard';
import { CUENTAS_COLORS, CuentasSecretariaBars } from '@/components/charts/CuentasSecretariaBars';
import { SupervisorBars } from '@/components/charts/SupervisorBars';
import { SupervisorContratosModal } from '@/components/SupervisorContratosModal';
import { EstadoCuentasDonut } from '@/components/charts/EstadoCuentasDonut';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SelectorSecretarias } from '@/components/ui/SelectorSecretarias';
import { SelectorAnios } from '@/components/ui/SelectorAnios';
import { ChartSkeleton, KpiSkeleton } from '@/components/ui/Skeletons';
import { useAuth } from '@/context/AuthContext';
import { useCdc } from '@/hooks/useCdc';
import { useContratos } from '@/hooks/useContratos';
import { fetchContratosSupervisados } from '@/api/contratos';
import { useContractAnalytics } from '@/hooks/useContractAnalytics';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { MESES, aniosDisponibles, buildCuentasSecretaria, contratoEnAnios, corteEfectivo, periodoFiltroLabel, secretariasDisponibles, } from '@/lib/cuentasSecretaria';
import { ALCANCES, SITUACIONES, buildCuentasDetalle, descargarCuentasExcel } from '@/lib/cuentasExcel';
import { ESTADO_GRUPOS } from '@/lib/estados';
import { descargarSupervisoresExcel } from '@/lib/supervisoresExcel';
import { buildContratosPorSupervisor } from '@/lib/supervisores';
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRelativeTime, normalizar, truncate, } from '@/lib/format';
const ETIQUETAS_ESTATUS = {
    connected: {
        label: 'Analítica en vivo',
        description: 'Los indicadores se recalculan con cada evento que Debezium transmite desde PostgreSQL.',
        icon: Wifi,
        tone: 'success',
        badge: 'Escuchando',
    },
    connecting: {
        label: 'Conectando con el flujo CDC',
        description: 'Estableciendo la conexión WebSocket con el backend.',
        icon: Radio,
        tone: 'warning',
        badge: 'Conectando',
    },
    disconnected: {
        label: 'Analítica sin señal CDC',
        description: 'Los indicadores muestran la última carga de /api/contratos; se reintentará la conexión automáticamente.',
        icon: WifiOff,
        tone: 'danger',
        badge: 'Desconectado',
    },
};
function CuentasLegend() {
    return (<div className="leyenda-cuentas">
      <span className="leyenda-item">
        <span className="leyenda-muestra" style={{ backgroundColor: CUENTAS_COLORS.completadas }}/>
        Completadas
      </span>
      <span className="leyenda-item">
        <span className="leyenda-muestra" style={{ backgroundColor: CUENTAS_COLORS.pendientes }}/>
        Pendientes
      </span>
    </div>);
}
export function AnaliticaPage() {
    const { data, isLoading, isError, refetch } = useContratos();
    const { status, url, events, lastEvent, reconnect } = useCdc();
    const { puede, rol, secretarias: secretariasSesion } = useAuth();
    const contratosSupervisadosQuery = useQuery({
        queryKey: ['contratos', 'supervisados'],
        queryFn: fetchContratosSupervisados,
        enabled: rol?.codigo === 'ENLACE',
        staleTime: 30_000,
    });
    const navigate = useNavigate();
    const hoy = useMemo(() => new Date(), []);
    const [aniosSeleccionados, setAniosSeleccionados] = useState([hoy.getFullYear()]);
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [mesHasta, setMesHasta] = useState('');
    const [desdeFecha, setDesdeFecha] = useState('');
    const [hastaFecha, setHastaFecha] = useState('');
    const [exportando, setExportando] = useState(false);
    const [exportandoSupervisor, setExportandoSupervisor] = useState(false);
    const [secretarias, setSecretarias] = useState([]);
    const [situacion, setSituacion] = useState('todas');
    const [alcance, setAlcance] = useState('corte');
    const [estadoGrupo, setEstadoGrupo] = useState('todos');
    const [textoCuenta, setTextoCuenta] = useState('');
    const [soloDeuda, setSoloDeuda] = useState(true);
    const [secretariasSupervisor, setSecretariasSupervisor] = useState([]);
    const [busquedaSupervisor, setBusquedaSupervisor] = useState('');
    const [limiteSupervisores, setLimiteSupervisores] = useState('12');
    const [supervisorSeleccionado, setSupervisorSeleccionado] = useState(null);
    const textoCuentaFiltrado = useDebouncedValue(textoCuenta.trim(), 250);
    const supervisorFiltrado = useDebouncedValue(busquedaSupervisor.trim(), 250);
    const opcionesAnio = useMemo(() => [...new Set([hoy.getFullYear(), ...(data ? aniosDisponibles(data) : [])])].sort((a, b) => b - a), [data, hoy]);
    const opcionesSecretaria = useMemo(() => (data ? secretariasDisponibles(data) : []), [data]);
    const contratosFiltrados = useMemo(() => (data ?? []).filter((contrato) => contratoEnAnios(contrato, aniosSeleccionados)), [data, aniosSeleccionados]);
    const analytics = useContractAnalytics(data ? contratosFiltrados : null);
    const anio = aniosSeleccionados.length ? Math.max(...aniosSeleccionados) : hoy.getFullYear();
    const rangoActivo = Boolean(desdeFecha || hastaFecha);
    const filtrosCuentas = useMemo(() => ({ anio, anios: aniosSeleccionados, mes, mesHasta, desdeFecha, hastaFecha, secretarias, situacion, alcance, soloDeuda, estado: estadoGrupo, texto: textoCuentaFiltrado, }), [anio, aniosSeleccionados, mes, mesHasta, desdeFecha, hastaFecha, secretarias, situacion, alcance, soloDeuda, estadoGrupo, textoCuentaFiltrado]);
    const cuentasSecretaria = useMemo(() => buildCuentasSecretaria(contratosFiltrados, filtrosCuentas, hoy), [contratosFiltrados, filtrosCuentas, hoy]);
    const detalleCuentas = useMemo(() => (data ? buildCuentasDetalle(contratosFiltrados, filtrosCuentas, hoy) : []), [data, contratosFiltrados, filtrosCuentas, hoy]);
    const descargarCuentas = async () => {
        if (!data || exportando || detalleCuentas.length === 0)
            return;
        setExportando(true);
        try {
            await descargarCuentasExcel(contratosFiltrados, filtrosCuentas, hoy);
        }
        finally {
            setExportando(false);
        }
    };
    const topeSupervisores = limiteSupervisores === 'todos' ? Number.POSITIVE_INFINITY : Number(limiteSupervisores);
    const contratosPorSupervisor = useMemo(() => buildContratosPorSupervisor(contratosFiltrados, {
        secretarias: secretariasSupervisor,
        busqueda: supervisorFiltrado,
        limite: topeSupervisores,
        limiteBusqueda: topeSupervisores,
    }), [contratosFiltrados, secretariasSupervisor, supervisorFiltrado, topeSupervisores]);
    const detalleSupervisor = useMemo(() => {
        if (!supervisorSeleccionado || rol?.codigo !== 'ENLACE') return supervisorSeleccionado;
        const permitidas = new Set(secretariasSesion.map(normalizar));
        const existentes = new Set((supervisorSeleccionado.contratos ?? []).map((item) => item.noContrato));
        const adicionales = (contratosSupervisadosQuery.data ?? [])
            .filter((item) => normalizar(item.supervisor) === normalizar(supervisorSeleccionado.label))
            .map((item) => item.contrato)
            .filter((item) => !permitidas.has(normalizar(item.dependencia)) && !existentes.has(item.noContrato)
                && contratoEnAnios(item, aniosSeleccionados));
        if (!adicionales.length) return supervisorSeleccionado;
        return {
            ...supervisorSeleccionado,
            value: supervisorSeleccionado.value + adicionales.length,
            alDia: supervisorSeleccionado.alDia + adicionales.reduce((sum, item) => sum + Math.min(item.cuentasRegistradas ?? 0, item.cuentasExigibles ?? 0), 0),
            represadas: supervisorSeleccionado.represadas + adicionales.reduce((sum, item) => sum + (item.cuentasEnMora ?? 0), 0),
            contratos: [...supervisorSeleccionado.contratos, ...adicionales],
        };
    }, [supervisorSeleccionado, rol, secretariasSesion, contratosSupervisadosQuery.data, aniosSeleccionados]);
    const descargarSupervisores = async () => {
        if (exportandoSupervisor || contratosPorSupervisor.coincidencias.length === 0)
            return;
        setExportandoSupervisor(true);
        try {
            await descargarSupervisoresExcel(contratosPorSupervisor.coincidencias, new Date());
        }
        finally {
            setExportandoSupervisor(false);
        }
    };
    const corte = corteEfectivo(filtrosCuentas, hoy);
    const corteLabel = formatDate(`${corte.getFullYear()}-${String(corte.getMonth() + 1).padStart(2, '0')}-${String(corte.getDate()).padStart(2, '0')}`);
    const cambiosRecientes = useMemo(() => events.slice(0, 8), [events]);
    const contratosEnFlujo = useMemo(() => new Set(events.map((event) => event.contrato)).size, [events]);
    const contratosAplicados = useMemo(() => {
        if (!data)
            return 0;
        const conocidos = new Set(data.map((contrato) => contrato.noContrato));
        return new Set(events
            .filter((event) => conocidos.has(event.contrato))
            .map((event) => event.contrato)).size;
    }, [data, events]);
    const menorAvance = useMemo(() => {
        if (!data)
            return [];
        return [...contratosFiltrados]
            .filter((contrato) => contrato.totalSupervisiones > 0)
            .sort((a, b) => (a.avanceDeclarado ?? 0) - (b.avanceDeclarado ?? 0))
            .slice(0, 10);
    }, [contratosFiltrados]);
    const informesPendientes = useMemo(() => {
        if (!data)
            return [];
        return contratosFiltrados
            .filter((contrato) => contrato.totalSupervisiones > 0 && !contrato.informeCargado)
            .sort((a, b) => b.porcentajeAvance - a.porcentajeAvance)
            .slice(0, 10);
    }, [contratosFiltrados]);
    if (isLoading) {
        return (<div className="pila-pagina-amplia">
          <PageHeader eyebrow="Analítica" title="Analítica" description="Consolidando la información de contratos…"/>
          <div className="kpi-cuadricula kpi-cuadricula-seis">
            {Array.from({ length: 6 }).map((_, index) => (<KpiSkeleton key={index}/>))}
          </div>
          <div className="cuadricula-panel">
            <ChartSkeleton height={340}/>
            <ChartSkeleton height={340}/>
          </div>
        </div>);
    }
    if (isError || !analytics || !data) {
        return (<div className="pila-pagina-amplia">
          <PageHeader eyebrow="Analítica" title="Analítica"/>
          <ErrorState onRetry={() => refetch()}/>
        </div>);
    }
    const { supervision, kpis, estadoCuentas } = analytics;
    const info = ETIQUETAS_ESTATUS[status];
    const StatusIcon = info.icon;
    const informesPct = kpis.totalContratos > 0 ? (kpis.informesCargados / kpis.totalContratos) * 100 : 0;
    return (<div className="pila-pagina-amplia">
      <PageHeader eyebrow="Analítica en vivo" title="Analítica" description="Indicadores calculados en el navegador sobre /api/contratos y actualizados al instante por el flujo PostgreSQL → Debezium → WebSocket." actions={<>
            <Link to="/tiempo-real" className="btn btn-ghost">
              Abrir monitor CDC
              <ArrowUpRight/>
            </Link>
            <Link to="/contratos?alerta=sin-informe" className="btn btn-primary">
              Ver informes pendientes
              <ArrowUpRight/>
            </Link>
          </>}/>

      <Card tone={info.tone} className="card-tono">
        <div className="banner-cuerpo">
          <span data-tone={info.tone} className="icono-globo icono-globo-banner">
            <StatusIcon className={status === 'connecting' ? 'parpadeo' : undefined}/>
          </span>
          <div className="banner-texto">
            <p className="banner-titulo">{info.label}</p>
            <p className="banner-detalle">{info.description}</p>
          </div>
          <div className="banner-stats">
            <div>
              <p className="micro-label">
                Eventos
              </p>
              <p className="banner-dato-valor">
                {formatNumber(events.length)}
              </p>
            </div>
            <div>
              <p className="micro-label">
                Contratos en el flujo
              </p>
              <p className="banner-dato-valor">
                {formatNumber(contratosEnFlujo)}
              </p>
            </div>
            <div>
              <p className="micro-label">
                Aplicados al tablero
              </p>
              <p className="banner-dato-valor">
                {formatNumber(contratosAplicados)}
              </p>
            </div>
            <div>
              <p className="micro-label">
                Último evento
              </p>
              <p className="banner-dato-texto">
                {lastEvent ? formatRelativeTime(lastEvent.timestamp) : '—'}
              </p>
            </div>
            <Badge tone={info.tone} dot>
              {info.badge}
            </Badge>
            <button type="button" className="btn btn-ghost" onClick={reconnect} title="Reconectar el WebSocket CDC">
              <RefreshCw/>
              Reconectar
            </button>
          </div>
        </div>
        <div className="banner-flujo">
          <span>PostgreSQL</span>
          <span aria-hidden="true">→</span>
          <span>Debezium</span>
          <span aria-hidden="true">→</span>
          <span>WebSocket</span>
          <code className="banner-url">{url}</code>
          <span aria-hidden="true">→</span>
          <span>Indicadores de esta página</span>
        </div>
      </Card>

      <div className="filtro-fila filtro-fila-periodo-global">
        <SelectorAnios opciones={opcionesAnio} valor={aniosSeleccionados} onChange={setAniosSeleccionados} anioActual={hoy.getFullYear()} etiqueta="Años de analítica" />
        <span className="texto-apoyo">Este filtro aplica a todos los indicadores, gráficas y tablas de esta página.</span>
      </div>

      <div className="kpi-cuadricula kpi-cuadricula-seis">
        <KpiCard label="Cobertura" value={formatPercent(supervision.cobertura, 1)} hint={`${formatNumber(supervision.conSupervision)} contratos con supervisión`} icon={ClipboardCheck} tone="brand" footer={<ProgressBar value={supervision.cobertura} size="sm"/>}/>
        <KpiCard label="Con supervisión" value={formatNumber(supervision.conSupervision)} hint="Al menos un registro" icon={Users} tone="sky"/>
        <KpiCard label="Sin supervisión" value={formatNumber(supervision.sinSupervision)} hint="Sin ningún registro" icon={ClipboardList} tone="rose"/>
        <KpiCard label="Promedio supervisiones" value={formatNumber(supervision.promedioSupervisiones)} hint="Por contrato supervisado" icon={TrendingUp} tone="violet"/>
        <KpiCard label="Avance certificado" value={formatPercent(supervision.promedioAvanceSupervisados, 1)} hint={`Promedio de ${formatNumber(supervision.conSupervision)} supervisados · solo ${formatNumber(kpis.informesCargados)} con cuenta radicada`} icon={TrendingUp} tone="amber" footer={<ProgressBar value={supervision.promedioAvanceSupervisados} size="sm"/>}/>
        <KpiCard label="Informes cargados" value={formatNumber(kpis.informesCargados)} hint={`${informesPct > 0 && informesPct < 0.1 ? '<0,1%' : formatPercent(informesPct, 1)} del total`} icon={FileCheck2} tone="brand"/>
      </div>

      <div className="cuadricula-panel">
        <ChartCard className="celda-col-corta" title="Estado de cuentas" subtitle="Contratos en proceso frente a los que están en devolución o rechazados.">
          <EstadoCuentasDonut enProceso={estadoCuentas.enProceso} devolucionRechazo={estadoCuentas.devolucionRechazo} pctEnProceso={estadoCuentas.pctEnProceso}/>
        </ChartCard>

        <ChartCard className="celda-col-grande" title="Cuentas por secretaría" subtitle="Completadas = informes registrados; pendientes = cuotas mensuales vencidas sin informe. Corte al período seleccionado, sin proyectar cuotas futuras." action={<CuentasLegend />} footer={<p className="pie-analitico">
              <span className="pie-analitico-cifra">{periodoFiltroLabel(filtrosCuentas, hoy)}</span> · corte
              al {corteLabel} · {formatNumber(cuentasSecretaria.totalCompletadas)} completadas ·{' '}
              {formatNumber(cuentasSecretaria.totalPendientes)} pendientes ·{' '}
              {formatNumber(cuentasSecretaria.contratosConDeuda)} contratos con deuda de{' '}
              {formatNumber(cuentasSecretaria.contratosEnPeriodo)} activos en el período.
            </p>}>
          <div className="pila-bloque">
            <div className="filtro-fila">
              <label className="campo-filtro" title="Fecha inicial del rango de calendario; filtra por el período de la cuota con precisión de día.">
                <span className="field-label-corto">
                  Desde
                </span>
                <input type="date" className="input input-corto input-fecha" value={desdeFecha} onChange={(event) => setDesdeFecha(event.target.value)} aria-label="Filtrar cuotas desde la fecha"/>
              </label>

              <label className="campo-filtro" title="Fecha final del rango; también es la fecha de corte: solo cuentan como pendientes las cuotas ya vencidas a ese día.">
                <span className="field-label-corto">
                  Hasta (día)
                </span>
                <input type="date" className="input input-corto input-fecha" value={hastaFecha} onChange={(event) => setHastaFecha(event.target.value)} aria-label="Filtrar cuotas hasta la fecha"/>
              </label>

              {rangoActivo ? (<button type="button" className="btn btn-ghost btn-limpiar-rango" onClick={() => { setDesdeFecha(''); setHastaFecha(''); }} title="Quitar el rango de fechas y volver a los selectores de año y mes">
                  Quitar rango
                </button>) : null}

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Mes
                </span>
                <select className="input input-corto input-mes" value={String(mes)} onChange={(event) => setMes(event.target.value === 'todos' ? 'todos' : Number(event.target.value))} disabled={rangoActivo} aria-label="Filtrar por mes">
                  <option value="todos">Todos</option>
                  {MESES.map((nombre, index) => (<option key={nombre} value={index + 1}>
                      {nombre}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro" title={rangoActivo ? 'Desactivado mientras el rango de fechas esté puesto' : 'Mes final del rango; déjalo en «—» para un solo mes (o el año completo si Mes = Todos)'}>
                <span className="field-label-corto">
                  Hasta
                </span>
                <select className="input input-corto input-mes-hasta" value={String(mesHasta)} onChange={(event) => setMesHasta(event.target.value === '' ? '' : Number(event.target.value))} disabled={rangoActivo} aria-label="Filtrar hasta el mes (rango opcional de meses)">
                  <option value="">—</option>
                  {MESES.map((nombre, index) => (<option key={nombre} value={index + 1}>
                      {nombre}
                    </option>))}
                </select>
              </label>

              <SelectorSecretarias opciones={opcionesSecretaria} valor={secretarias} onChange={setSecretarias} etiqueta="Secretarías" />

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Situación
                </span>
                <select className="input input-corto input-situacion" value={situacion} onChange={(event) => setSituacion(event.target.value)} aria-label="Filtrar cuentas por situación">
                  {SITUACIONES.map((opcion) => (<option key={opcion.valor} value={opcion.valor}>
                      {opcion.label}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro" title={rangoActivo ? 'El rango de fechas ya define el alcance; desactivado mientras está puesto.' : 'Todo lo vencido hasta la fecha de corte reproduce el mismo total que mide el gráfico; el período solo toma las cuotas de los meses elegidos.'}>
                <span className="field-label-corto">
                  Alcance
                </span>
                <select className="input input-corto input-alcance" value={alcance} onChange={(event) => setAlcance(event.target.value)} disabled={rangoActivo} aria-label="Alcance del archivo Excel">
                  {ALCANCES.map((opcion) => (<option key={opcion.valor} value={opcion.valor}>
                      {opcion.label}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Estado del contrato
                </span>
                <select className="input input-corto input-grupo-estado" value={estadoGrupo} onChange={(event) => setEstadoGrupo(event.target.value)} aria-label="Filtrar por estado del contrato">
                  <option value="todos">Todos</option>
                  {ESTADO_GRUPOS.map((opcion) => (<option key={opcion.valor} value={opcion.valor}>
                      {opcion.label}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Buscar contrato o supervisor
                </span>
                <span className="busqueda-listado">
                  <Search className="input-icono"/>
                  <input className="input input-corto input-con-icono" value={textoCuenta} onChange={(event) => setTextoCuenta(event.target.value)} placeholder="STD-CD-…" aria-label="Buscar por contrato, contratista o supervisor"/>
                </span>
              </label>

              <label className="campo-check" title="Solo afecta al gráfico: oculta las secretarías sin cuentas pendientes.">
                <input type="checkbox" className="campo-check-input" checked={soloDeuda} onChange={(event) => setSoloDeuda(event.target.checked)}/>
                Solo con deuda
              </label>

              {puede('CONTRATOS_EXPORTAR') ? (<button type="button" className="btn btn-primary filtro-accion" onClick={descargarCuentas} disabled={exportando || detalleCuentas.length === 0} title="Excel con una fila por cuota del contrato: las radicadas con su período, estado y siguiente paso reales, y las pendientes sin radicar. Respeta secretarías, el rango de fechas (o el período en meses), situación, estado y búsqueda.">
                <Download/>
                {exportando ? 'Generando…' : 'Descargar Excel'}
                <span className="btn-contador">
                  {formatNumber(detalleCuentas.length)}
                </span>
              </button>) : null}
            </div>

            {detalleCuentas.length > 8000 ? (<p className="nota-volumen">
                Son {formatNumber(detalleCuentas.length)} filas, una por cuota {rangoActivo ? 'del rango de fechas' : alcance === 'corte' ? 'vencida hasta el corte' : 'del período elegido'}.
                {rangoActivo
                    ? ' Acorta «Desde» y «Hasta» o restringe la secretaría y el estado del contrato para un archivo más liviano.'
                    : `${alcance === 'corte' ? ' Cambia el alcance a «Solo las cuotas del período» o' : ''} acota el mes, la secretaría o el estado del contrato para un archivo más liviano.`}
                {detalleCuentas.length > 100000 ? ' Con este volumen el archivo puede tardar más de un minuto en armarse.' : ''}
              </p>) : null}

            {cuentasSecretaria.rows.length > 0 ? (<CuentasSecretariaBars data={cuentasSecretaria.rows} height={Math.max(280, cuentasSecretaria.rows.length * 36 + 30)}/>) : (<div className="caja-vacia caja-vacia-alta">
                <p className="caja-vacia-titulo">
                  Sin cuentas pendientes en el período
                </p>
                <p className="caja-vacia-detalle">
                  Ajusta el rango de fechas, el año, el mes o la secretaría; también puedes desmarcar «Solo con deuda».
                </p>
              </div>)}
          </div>
        </ChartCard>

        <ChartCard className="celda-col-completa" title="Contratos por supervisor" subtitle="Carga de cada supervisor: se toma el de la última supervisión registrada en cada contrato. Selecciona una barra para ver sus contratos y las cuentas a tiempo o represadas." footer={<p className="pie-analitico">
              <span className="pie-analitico-cifra">
                {formatNumber(contratosPorSupervisor.supervisores)}
              </span>{' '}
              supervisores con contratos asignados ·{' '}
              {formatNumber(contratosPorSupervisor.contratos)} contratos · el de mayor carga{' '}
              {formatNumber(contratosPorSupervisor.maximo)} · promedio{' '}
              {contratosPorSupervisor.promedio.toFixed(1).replace('.', ',')} por supervisor ·{' '}
              <span className="dato-cifra-ok">
                {formatNumber(contratosPorSupervisor.alDia)}
              </span>{' '}
              cuentas a tiempo ·{' '}
              <span className="dato-cifra-alerta">
                {formatNumber(contratosPorSupervisor.represadas)}
              </span>{' '}
              represadas
              {busquedaSupervisor.trim()
                ? ` · ${formatNumber(contratosPorSupervisor.coincidencias.length)} coinciden con la búsqueda`
                : ''}
              {contratosPorSupervisor.ocultos > 0
                ? ` · se dibujan los ${contratosPorSupervisor.rows.length} con más contratos`
                : '.'}
            </p>}>
          <div className="pila-bloque">
            <div className="filtro-fila">
              <label className="campo-filtro">
                <span className="field-label-corto">
                  Buscar supervisor
                </span>
                <span className="busqueda-listado">
                  <Search className="input-icono"/>
                  <input className="input input-corto input-con-icono" value={busquedaSupervisor} onChange={(event) => setBusquedaSupervisor(event.target.value)} placeholder="Nombre o apellido" aria-label="Buscar supervisor por nombre"/>
                </span>
              </label>

              <SelectorSecretarias opciones={opcionesSecretaria} valor={secretariasSupervisor} onChange={setSecretariasSupervisor} etiqueta="Secretarías" />

              <label className="campo-filtro">
                <span className="field-label-corto">Mostrar</span>
                <select
                  className="input input-corto"
                  value={limiteSupervisores}
                  onChange={(event) => setLimiteSupervisores(event.target.value)}
                  aria-label="Cantidad de supervisores en el gráfico"
                >
                  <option value="12">12 supervisores</option>
                  <option value="25">25 supervisores</option>
                  <option value="50">50 supervisores</option>
                  <option value="100">100 supervisores</option>
                  <option value="todos">Todos</option>
                </select>
              </label>

              {puede('CONTRATOS_EXPORTAR') ? (<button type="button" className="btn btn-primary filtro-accion" onClick={descargarSupervisores} disabled={exportandoSupervisor || contratosPorSupervisor.coincidencias.length === 0} title="Excel con dos hojas: el resumen de todos los supervisores del filtro (no solo los del gráfico) y un renglón por cada contrato asignado.">
                <Download/>
                {exportandoSupervisor ? 'Generando…' : 'Descargar Excel'}
                <span className="btn-contador">
                  {formatNumber(contratosPorSupervisor.coincidencias.length)}
                </span>
              </button>) : null}
            </div>

            {contratosPorSupervisor.rows.length > 0 ? (<SupervisorBars data={contratosPorSupervisor.rows} height={Math.max(260, contratosPorSupervisor.rows.length * 32 + 40)} onSupervisorSelect={setSupervisorSeleccionado}/>) : (<EmptyState title={busquedaSupervisor.trim() ? 'Ningún supervisor coincide' : 'Sin supervisores asignados'} description={busquedaSupervisor.trim() ? 'Revisa la búsqueda o limpia el nombre para volver a ver toda la carga.' : 'Ningún contrato de estas secretarías tiene supervisor en su última supervisión registrada.'}/>)}
          </div>
        </ChartCard>
      </div>

      <div className="cuadricula-panel">
        <Card className="celda-col-media">
          <CardHeader title="Cambios aplicados en vivo" subtitle="Últimos eventos CDC que actualizaron los indicadores de esta página." action={<Link to="/tiempo-real" className="link link-inline">
                Ver monitor
                <ArrowUpRight/>
              </Link>}/>
          {cambiosRecientes.length === 0 ? (<EmptyState icon={Radio} title="Esperando cambios de PostgreSQL" description="Cuando Debezium detecte un cambio en contratos, supervisiones o informes, aparecerá aquí y los indicadores se actualizarán."/>) : (<div className="deslizable-x">
              <table className="tabla-listado tabla-listado-medio">
                <thead>
                  <tr>
                    <th className="table-th">Contrato</th>
                    <th className="table-th">Origen</th>
                    <th className="table-th">Estado</th>
                    <th className="table-th table-th-derecha">Momento</th>
                  </tr>
                </thead>
                <tbody>
                  {cambiosRecientes.map((event, index) => (<tr key={`${event.contrato}-${event.timestamp}-${index}`} className="table-row" onClick={() => navigate(`/contratos/${encodeURIComponent(event.contrato)}`)}>
                      <td className="table-td sin-ajuste celda-titulo">
                        <Link to={`/contratos/${encodeURIComponent(event.contrato)}`} className="link" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                          {event.contrato}
                        </Link>
                      </td>
                      <td className="table-td">
                        <div className="celda-mixta">
                          <Badge tone="info">{event.tipo}</Badge>
                          <span className="texto-apoyo">{event.tabla}</span>
                        </div>
                      </td>
                      <td className="table-td celda-estado">
                        <EstadoBadge id={event.estado.id_estado} label={event.estado.estado}/>
                      </td>
                      <td className="table-td celda-momento" title={formatDateTime(event.timestamp)}>
                        {formatRelativeTime(event.timestamp)}
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </Card>

        <Card className="celda-col-larga">
          <CardHeader title="Informes pendientes" subtitle="Contratos con supervisión registrada pero sin informe cargado." action={<Link to="/contratos?alerta=sin-informe" className="link link-inline">
                Ver todos
                <ArrowUpRight/>
              </Link>}/>
          {informesPendientes.length === 0 ? (<EmptyState icon={FileCheck2} title="Sin informes pendientes" description="Todos los contratos supervisados tienen informe de actividades cargado."/>) : (<div className="deslizable-x">
              <table className="tabla-listado tabla-listado-estrecho">
                <thead>
                  <tr>
                    <th className="table-th">Contrato</th>
                    <th className="table-th">Contratista</th>
                    <th className="table-th table-th-centro">Supervisiones</th>
                    <th className="table-th">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {informesPendientes.map((contrato) => (<tr key={contrato.noContrato ?? contrato.id} className="table-row" onClick={() => {
                    if (contrato.noContrato) {
                        navigate(`/contratos/${encodeURIComponent(contrato.noContrato)}`);
                    }
                }}>
                      <td className="table-td sin-ajuste celda-titulo">
                        {contrato.noContrato ? (<Link to={`/contratos/${encodeURIComponent(contrato.noContrato)}`} className="link" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                            {contrato.noContrato}
                          </Link>) : ('—')}
                      </td>
                      <td className="table-td celda-amplia celda-recortada">
                        <span title={contrato.contratista ?? undefined}>
                          {truncate(contrato.contratista, 34)}
                        </span>
                      </td>
                      <td className="table-td celda-cifra">
                        {contrato.totalSupervisiones}
                      </td>
                      <td className="table-td celda-estado">
                        <EstadoBadge id={contrato.idEstadoActual} label={contrato.estadoActual}/>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </Card>

        <Card className="celda-col-completa">
          <CardHeader title="Menor avance declarado" subtitle="Lo que registró el supervisor en su última visita; sin cuenta radicada no hay avance certificado." action={<Link to="/contratos?orden=avance-asc" className="link link-inline">
                Ver listado
                <ArrowUpRight/>
              </Link>}/>
          {menorAvance.length === 0 ? (<EmptyState title="Sin contratos supervisados"/>) : (<div className="deslizable-x">
              <table className="tabla-listado tabla-listado-ancho">
                <thead>
                  <tr>
                    <th className="table-th">Contrato</th>
                    <th className="table-th">Contratista</th>
                    <th className="table-th table-th-centro">Supervisiones</th>
                    <th className="table-th table-th-avance-corto">Avance declarado</th>
                    <th className="table-th">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {menorAvance.map((contrato) => (<tr key={contrato.noContrato ?? contrato.id} className="table-row" onClick={() => {
                    if (contrato.noContrato) {
                        navigate(`/contratos/${encodeURIComponent(contrato.noContrato)}`);
                    }
                }}>
                      <td className="table-td sin-ajuste celda-titulo">
                        {contrato.noContrato ? (<Link to={`/contratos/${encodeURIComponent(contrato.noContrato)}`} className="link" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                            {contrato.noContrato}
                          </Link>) : ('—')}
                      </td>
                      <td className="table-td celda-amplia celda-recortada">
                        <span title={contrato.contratista ?? undefined}>
                          {truncate(contrato.contratista, 34)}
                        </span>
                      </td>
                      <td className="table-td celda-cifra">
                        {contrato.totalSupervisiones}
                      </td>
                      <td className="table-td">
                        <ProgressBar value={contrato.avanceDeclarado ?? 0} showLabel size="sm"/>
                      </td>
                      <td className="table-td celda-estado">
                        <EstadoBadge id={contrato.idEstadoActual} label={contrato.estadoActual}/>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </Card>
      </div>

      {supervisorSeleccionado ? (<SupervisorContratosModal supervisor={detalleSupervisor} onClose={() => setSupervisorSeleccionado(null)}/>) : null}
      </div>);
}
