import { ArrowUpRight, ClipboardCheck, ClipboardList, Download, FileCheck2, Search, TrendingUp, Users, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChartCard } from '@/components/charts/ChartCard';
import { CUENTAS_COLORS, CuentasSecretariaBars } from '@/components/charts/CuentasSecretariaBars';
import { SupervisorBars } from '@/components/charts/SupervisorBars';
import { SupervisorContratosModal } from '@/components/SupervisorContratosModal';
import { EstadoCuentasDonut } from '@/components/charts/EstadoCuentasDonut';
import { LeadTimeBarras } from '@/components/charts/LeadTimeBarras';
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
import { useContratos } from '@/hooks/useContratos';
import { fetchContratosSupervisados } from '@/api/contratos';
import { useContractAnalytics } from '@/hooks/useContractAnalytics';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { aniosDisponibles, buildCuentasSecretaria, contratoEnAnios, corteEfectivo, periodoFiltroLabel, secretariasDisponibles, } from '@/lib/cuentasSecretaria';
import { buildCuentasDetalle, descargarCuentasExcel } from '@/lib/cuentasExcel';
import { buildLeadTime, formatDuracion } from '@/lib/leadTime';
import { ALCANCES_CUENTAS, contratoEnAlcance, contratosEnAlcance } from '@/lib/alcanceCuentas';
import { descargarLeadTimeExcel } from '@/lib/leadTimeExcel';
import { descargarSupervisoresExcel } from '@/lib/supervisoresExcel';
import { buildContratosPorSupervisor } from '@/lib/supervisores';
import { formatDate, formatNumber, formatPercent, normalizar, truncate, } from '@/lib/format';
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
    const [mes] = useState('todos');
    const [mesHasta] = useState('');
    const [desdeFecha] = useState('');
    const [hastaFecha] = useState('');
    const [exportando, setExportando] = useState(false);
    const [exportandoSupervisor, setExportandoSupervisor] = useState(false);
    const [exportandoLead, setExportandoLead] = useState(false);
    const [alcanceCuentas, setAlcanceCuentas] = useState('curso');
    const [secretarias] = useState([]);
    const [situacion] = useState('todas');
    const [alcance] = useState('corte');
    const [estadoGrupo] = useState('todos');
    const [textoCuenta] = useState('');
    const [soloDeuda] = useState(false);
    const [secretariasSupervisor, setSecretariasSupervisor] = useState([]);
    const [busquedaSupervisor, setBusquedaSupervisor] = useState('');
    const [limiteSupervisores, setLimiteSupervisores] = useState('12');
    const [supervisorSeleccionado, setSupervisorSeleccionado] = useState(null);
    const textoCuentaFiltrado = useDebouncedValue(textoCuenta.trim(), 250);
    const supervisorFiltrado = useDebouncedValue(busquedaSupervisor.trim(), 250);
    const opcionesAnio = useMemo(() => [...new Set([hoy.getFullYear(), ...(data ? aniosDisponibles(data) : [])])].sort((a, b) => b - a), [data, hoy]);
    const opcionesSecretaria = useMemo(() => (data ? secretariasDisponibles(data) : []), [data]);
    const contratosFiltrados = useMemo(() => (data ?? []).filter((contrato) => contratoEnAnios(contrato, aniosSeleccionados)), [data, aniosSeleccionados]);
    // El alcance de cuentas recorta el universo que se mide en toda la página.
    const contratosVisibles = useMemo(() => contratosEnAlcance(contratosFiltrados, alcanceCuentas), [contratosFiltrados, alcanceCuentas]);
    const analytics = useContractAnalytics(data ? contratosVisibles : null);
    const anio = aniosSeleccionados.length ? Math.max(...aniosSeleccionados) : hoy.getFullYear();
    const filtrosCuentas = useMemo(() => ({ anio, anios: aniosSeleccionados, mes, mesHasta, desdeFecha, hastaFecha, secretarias, situacion, alcance, soloDeuda, estado: estadoGrupo, texto: textoCuentaFiltrado, }), [anio, aniosSeleccionados, mes, mesHasta, desdeFecha, hastaFecha, secretarias, situacion, alcance, soloDeuda, estadoGrupo, textoCuentaFiltrado]);
    const cuentasSecretaria = useMemo(() => buildCuentasSecretaria(contratosVisibles, filtrosCuentas, hoy), [contratosVisibles, filtrosCuentas, hoy]);
    const detalleCuentas = useMemo(() => (data ? buildCuentasDetalle(contratosVisibles, filtrosCuentas, hoy) : []), [data, contratosVisibles, filtrosCuentas, hoy]);
    const descargarCuentas = async () => {
        if (!data || exportando || detalleCuentas.length === 0)
            return;
        setExportando(true);
        try {
            await descargarCuentasExcel(contratosVisibles, filtrosCuentas, hoy);
        }
        finally {
            setExportando(false);
        }
    };
    const topeSupervisores = limiteSupervisores === 'todos' ? Number.POSITIVE_INFINITY : Number(limiteSupervisores);
    const contratosPorSupervisor = useMemo(() => buildContratosPorSupervisor(contratosVisibles, {
        secretarias: secretariasSupervisor,
        busqueda: supervisorFiltrado,
        limite: topeSupervisores,
        limiteBusqueda: topeSupervisores,
    }), [contratosVisibles, secretariasSupervisor, supervisorFiltrado, topeSupervisores]);
    const detalleSupervisor = useMemo(() => {
        if (!supervisorSeleccionado || rol?.codigo !== 'ENLACE') return supervisorSeleccionado;
        const permitidas = new Set(secretariasSesion.map(normalizar));
        const existentes = new Set((supervisorSeleccionado.contratos ?? []).map((item) => item.noContrato));
        const adicionales = (contratosSupervisadosQuery.data ?? [])
            .filter((item) => normalizar(item.supervisor) === normalizar(supervisorSeleccionado.label))
            .map((item) => item.contrato)
            .filter((item) => !permitidas.has(normalizar(item.dependencia)) && !existentes.has(item.noContrato)
                && contratoEnAnios(item, aniosSeleccionados) && contratoEnAlcance(item, alcanceCuentas));
        if (!adicionales.length) return supervisorSeleccionado;
        return {
            ...supervisorSeleccionado,
            value: supervisorSeleccionado.value + adicionales.length,
            alDia: supervisorSeleccionado.alDia + adicionales.reduce((sum, item) => sum + Math.min(item.cuentasRegistradas ?? 0, item.cuentasExigibles ?? 0), 0),
            represadas: supervisorSeleccionado.represadas + adicionales.reduce((sum, item) => sum + (item.cuentasEnMora ?? 0), 0),
            contratos: [...supervisorSeleccionado.contratos, ...adicionales],
        };
    }, [supervisorSeleccionado, rol, secretariasSesion, contratosSupervisadosQuery.data, aniosSeleccionados, alcanceCuentas]);
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
    const leadTime = useMemo(() => buildLeadTime(contratosVisibles, alcanceCuentas, hoy), [contratosVisibles, alcanceCuentas, hoy]);
    const descargarLeadTime = async () => {
        if (exportandoLead || leadTime.rows.length === 0)
            return;
        setExportandoLead(true);
        try {
            await descargarLeadTimeExcel(leadTime, alcanceCuentas, hoy);
        }
        finally {
            setExportandoLead(false);
        }
    };
    const menorAvance = useMemo(() => {
        if (!data)
            return [];
        return [...contratosVisibles]
            .filter((contrato) => contrato.totalSupervisiones > 0)
            .sort((a, b) => (a.avanceDeclarado ?? 0) - (b.avanceDeclarado ?? 0))
            .slice(0, 10);
    }, [contratosVisibles]);
    const informesPendientes = useMemo(() => {
        if (!data)
            return [];
        return contratosVisibles
            .filter((contrato) => contrato.totalSupervisiones > 0 && !contrato.informeCargado)
            .sort((a, b) => b.porcentajeAvance - a.porcentajeAvance)
            .slice(0, 10);
    }, [contratosVisibles]);
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
    const informesPct = kpis.totalContratos > 0 ? (kpis.informesCargados / kpis.totalContratos) * 100 : 0;
    return (<div className="pila-pagina-amplia">
      <div className="filtro-fila filtro-fila-periodo-global">
        <SelectorAnios opciones={opcionesAnio} valor={aniosSeleccionados} onChange={setAniosSeleccionados} anioActual={hoy.getFullYear()} etiqueta="Años de analítica" />
        <label className="campo-filtro" title="«En curso» (por defecto) mide solo las cuentas que siguen abiertas; «Cerradas» solo las ya cerradas (estado 19); «Ambas» une los dos universos. Cambia el universo de cuentas de toda la página.">
          <span className="field-label-corto">
            Cuentas
          </span>
          <select className="input input-corto" value={alcanceCuentas} onChange={(event) => setAlcanceCuentas(event.target.value)} aria-label="Alcance de cuentas de la analítica">
            {ALCANCES_CUENTAS.map((opcion) => (<option key={opcion.valor} value={opcion.valor}>
                {opcion.label}
              </option>))}
          </select>
        </label>
        <span className="texto-apoyo">Estos filtros aplican a todos los indicadores, gráficas y tablas de esta página.</span>
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

              {puede('CONTRATOS_EXPORTAR') ? (<button type="button" className="btn btn-primary filtro-accion" onClick={descargarCuentas} disabled={exportando || detalleCuentas.length === 0} title="Excel con una fila por cuota del contrato: las radicadas con su período, estado y siguiente paso reales, y las pendientes sin radicar.">
                <Download/>
                {exportando ? 'Generando…' : 'Descargar Excel'}
                <span className="btn-contador">
                  {formatNumber(detalleCuentas.length)}
                </span>
              </button>) : null}
            </div>

            {detalleCuentas.length > 8000 ? (<p className="nota-volumen">
                Son {formatNumber(detalleCuentas.length)} filas, una por cuota vencida hasta el corte.
                {detalleCuentas.length > 100000 ? ' Con este volumen el archivo puede tardar más de un minuto en armarse.' : ''}
              </p>) : null}

            {cuentasSecretaria.rows.length > 0 ? (<CuentasSecretariaBars data={cuentasSecretaria.rows} height={Math.max(280, cuentasSecretaria.rows.length * 36 + 30)}/>) : (<div className="caja-vacia caja-vacia-alta">
                <p className="caja-vacia-titulo">
                  Sin cuentas pendientes en el período
                </p>
                <p className="caja-vacia-detalle">
                  Ajusta el año de analítica o el alcance de cuentas (En curso, Cerradas o Ambas) de la barra superior.
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
        <ChartCard className="celda-col-media" title="Desglose del Lead Time por Proceso y Etapa" subtitle="Cada barra es el tiempo total de un bloque (área), repartido en etapas con valor (procesamiento y entrega) y tiempos muertos (aprobación y espera)." action={puede('CONTRATOS_EXPORTAR') ? (<button type="button" className="btn btn-primary" onClick={descargarLeadTime} disabled={exportandoLead || leadTime.rows.length === 0} title="Excel con la tabla del diagrama (fórmulas dinámicas contra la hoja Datos) y un renglón por cada tramo de tiempo de cada cuenta, para ver el porqué de cada cifra.">
            <Download/>
            {exportandoLead ? 'Generando…' : 'Descargar Excel'}
          </button>) : null} footer={leadTime.rows.length > 0 ? (<p className="pie-analitico">
              <span className="pie-analitico-cifra">
                {formatDuracion(leadTime.totales.total)}
              </span>{' '}
              de Lead Time acumulado ·{' '}
              <span className="dato-cifra-alerta">
                {formatPercent(leadTime.totales.total > 0 ? (leadTime.totales.muertos / leadTime.totales.total) * 100 : 0, 1)}
              </span>{' '}
              de tiempo muerto (aprobación y cola) ·{' '}
              {formatNumber(leadTime.cuentas)} {leadTime.cuentas === 1 ? 'cuenta' : 'cuentas'} · {formatNumber(leadTime.detalle.length)} {leadTime.detalle.length === 1 ? 'tramo' : 'tramos'} de tiempo.
            </p>) : null}>
          {leadTime.rows.length > 0 ? (<LeadTimeBarras data={leadTime.rows} height={Math.max(300, leadTime.rows.length * 46 + 60)}/>) : (<EmptyState icon={TrendingUp} title="Sin cuentas en este alcance" description="Cambia el filtro de Cuentas de arriba a «Ambas» o amplía el filtro de años para ver el desglose."/>)}
        </ChartCard>

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
