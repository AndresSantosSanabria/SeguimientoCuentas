import { ArrowUpRight, ClipboardCheck, ClipboardList, Download, FileCheck2, Radio, RefreshCw, TrendingUp, Users, Wifi, WifiOff, } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { ChartSkeleton, KpiSkeleton } from '@/components/ui/Skeletons';
import { useCdc } from '@/hooks/useCdc';
import { useContratos } from '@/hooks/useContratos';
import { useContractAnalytics } from '@/hooks/useContractAnalytics';
import { MESES, aniosDisponibles, buildCuentasSecretaria, cortePeriodo, periodoLabel, secretariasDisponibles, } from '@/lib/cuentasSecretaria';
import { buildCuentasPendientesDetalle, descargarCuentasPendientesExcel } from '@/lib/cuentasExcel';
import { buildContratosPorSupervisor } from '@/lib/supervisores';
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRelativeTime, truncate, } from '@/lib/format';
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
    const analytics = useContractAnalytics(data);
    const { status, url, events, lastEvent, reconnect } = useCdc();
    const navigate = useNavigate();
    const hoy = useMemo(() => new Date(), []);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [mesHasta, setMesHasta] = useState('');
    const [exportando, setExportando] = useState(false);
    const [secretaria, setSecretaria] = useState('');
    const [soloDeuda, setSoloDeuda] = useState(true);
    const [secretariaSupervisor, setSecretariaSupervisor] = useState('');
    const [supervisorSeleccionado, setSupervisorSeleccionado] = useState(null);
    const anios = useMemo(() => (data ? aniosDisponibles(data) : []), [data]);
    const opcionesAnio = useMemo(() => [...new Set([hoy.getFullYear(), ...anios])].sort((a, b) => b - a), [anios, hoy]);
    const opcionesSecretaria = useMemo(() => (data ? secretariasDisponibles(data) : []), [data]);
    const cuentasSecretaria = useMemo(() => buildCuentasSecretaria(data ?? [], { anio, mes, mesHasta, secretaria, soloDeuda }, hoy), [data, anio, mes, mesHasta, secretaria, soloDeuda, hoy]);
    const detalleCuentas = useMemo(() => (data ? buildCuentasPendientesDetalle(data, { anio, mes, mesHasta, secretaria }, hoy) : []), [data, anio, mes, mesHasta, secretaria, hoy]);
    const descargarCuentas = async () => {
        if (!data || exportando || detalleCuentas.length === 0)
            return;
        setExportando(true);
        try {
            await descargarCuentasPendientesExcel(data, { anio, mes, mesHasta, secretaria }, hoy);
        }
        finally {
            setExportando(false);
        }
    };
    const contratosPorSupervisor = useMemo(() => buildContratosPorSupervisor(data ?? [], { secretaria: secretariaSupervisor }), [data, secretariaSupervisor]);
    const corte = cortePeriodo(anio, mes, hoy, mesHasta);
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
        return [...data]
            .filter((contrato) => contrato.totalSupervisiones > 0)
            .sort((a, b) => (a.avanceDeclarado ?? 0) - (b.avanceDeclarado ?? 0))
            .slice(0, 10);
    }, [data]);
    const informesPendientes = useMemo(() => {
        if (!data)
            return [];
        return data
            .filter((contrato) => contrato.totalSupervisiones > 0 && !contrato.informeCargado)
            .sort((a, b) => b.porcentajeAvance - a.porcentajeAvance)
            .slice(0, 10);
    }, [data]);
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
              <span className="pie-analitico-cifra">{periodoLabel(anio, mes, mesHasta)}</span> · corte
              al {corteLabel} · {formatNumber(cuentasSecretaria.totalCompletadas)} completadas ·{' '}
              {formatNumber(cuentasSecretaria.totalPendientes)} pendientes ·{' '}
              {formatNumber(cuentasSecretaria.contratosConDeuda)} contratos con deuda de{' '}
              {formatNumber(cuentasSecretaria.contratosEnPeriodo)} activos en el período.
            </p>}>
          <div className="pila-bloque">
            <div className="filtro-fila">
              <label className="campo-filtro">
                <span className="field-label-corto">
                  Año
                </span>
                <select className="input input-corto input-anio" value={anio} onChange={(event) => setAnio(Number(event.target.value))} aria-label="Filtrar por año">
                  {opcionesAnio.map((opcion) => (<option key={opcion} value={opcion}>
                      {opcion}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Mes
                </span>
                <select className="input input-corto input-mes" value={String(mes)} onChange={(event) => setMes(event.target.value === 'todos' ? 'todos' : Number(event.target.value))} aria-label="Filtrar por mes">
                  <option value="todos">Todos</option>
                  {MESES.map((nombre, index) => (<option key={nombre} value={index + 1}>
                      {nombre}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro" title="Mes final del rango; déjalo en «—» para un solo mes (o el año completo si Mes = Todos)">
                <span className="field-label-corto">
                  Hasta
                </span>
                <select className="input input-corto input-mes-hasta" value={String(mesHasta)} onChange={(event) => setMesHasta(event.target.value === '' ? '' : Number(event.target.value))} aria-label="Filtrar hasta el mes (rango opcional de meses)">
                  <option value="">—</option>
                  {MESES.map((nombre, index) => (<option key={nombre} value={index + 1}>
                      {nombre}
                    </option>))}
                </select>
              </label>

              <label className="campo-filtro">
                <span className="field-label-corto">
                  Secretaría
                </span>
                <select className="input input-corto input-secretaria" value={secretaria} onChange={(event) => setSecretaria(event.target.value)} aria-label="Filtrar por secretaría">
                  <option value="">Todas</option>
                  {opcionesSecretaria.map((opcion) => (<option key={opcion} value={opcion}>
                      {opcion}
                    </option>))}
                </select>
              </label>

              <label className="campo-check">
                <input type="checkbox" className="campo-check-input" checked={soloDeuda} onChange={(event) => setSoloDeuda(event.target.checked)}/>
                Solo con deuda
              </label>

              <button type="button" className="btn btn-primary filtro-accion" onClick={descargarCuentas} disabled={exportando || detalleCuentas.length === 0} title="Descarga el detalle de cuentas pendientes (una fila por contrato y mes) filtrado por secretaría y rango de meses.">
                <Download/>
                {exportando ? 'Generando…' : 'Descargar Excel'}
                <span className="btn-contador">
                  {formatNumber(detalleCuentas.length)}
                </span>
              </button>
            </div>

            {cuentasSecretaria.rows.length > 0 ? (<CuentasSecretariaBars data={cuentasSecretaria.rows} height={Math.max(280, cuentasSecretaria.rows.length * 36 + 30)}/>) : (<div className="caja-vacia caja-vacia-alta">
                <p className="caja-vacia-titulo">
                  Sin cuentas pendientes en el período
                </p>
                <p className="caja-vacia-detalle">
                  Ajusta el año, el mes o la secretaría; también puedes desmarcar «Solo con deuda».
                </p>
              </div>)}
          </div>
        </ChartCard>

        <ChartCard className="celda-col-completa" title="Contratos por supervisor" subtitle="Carga de cada supervisor: se toma el de la última supervisión registrada en cada contrato. Selecciona una barra para ver sus contratistas y las cuentas a tiempo o represadas." action={<label className="campo-filtro">
              <span className="field-label-corto">
                Secretaría
              </span>
              <select className="input input-corto input-secretaria" value={secretariaSupervisor} onChange={(event) => setSecretariaSupervisor(event.target.value)} aria-label="Filtrar supervisores por secretaría">
                <option value="">Todas</option>
                {opcionesSecretaria.map((opcion) => (<option key={opcion} value={opcion}>
                    {opcion}
                  </option>))}
              </select>
            </label>} footer={<p className="pie-analitico">
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
              {contratosPorSupervisor.ocultos > 0
                ? ` · se muestran los ${contratosPorSupervisor.rows.length} con más contratos`
                : '.'}
            </p>}>
          {contratosPorSupervisor.rows.length > 0 ? (<SupervisorBars data={contratosPorSupervisor.rows} height={Math.max(260, contratosPorSupervisor.rows.length * 32 + 40)} onSupervisorSelect={setSupervisorSeleccionado}/>) : (<EmptyState title="Sin supervisores asignados" description="Ningún contrato de esta secretaría tiene supervisor en su última supervisión registrada."/>) }
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

      {supervisorSeleccionado ? (<SupervisorContratosModal supervisor={supervisorSeleccionado} onClose={() => setSupervisorSeleccionado(null)}/>) : null}
    </div>);
}
