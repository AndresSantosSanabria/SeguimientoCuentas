import { Activity, ArrowUpRight, Download, Search, TrendingUp, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChartCard } from '@/features/analitica';
import { CUENTAS_COLORS, CuentasSecretariaBars } from '@/features/analitica';
import { SupervisorBars } from '@/features/analitica';
import { SupervisorContratosModal } from '@/features/analitica';
import { EstadoCuentasDonut } from '@/features/analitica';
import { LeadTimeBarras } from '@/features/analitica';
import { CalificacionRiesgoPanel, buildCalificacionRiesgo } from '@/features/analitica';
import { ComparativaSecretarias, useComparativaSecretarias } from '@/features/analitica';
import { Card, CardHeader } from '@/shared/components/ui';
import { Desplegable } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/ui';
import { ErrorState } from '@/shared/components/ui';
import { EstadoBadge } from '@/features/cuentas';
import { KpiCard } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui';
import { ProgressBar } from '@/shared/components/ui';
import { SelectorSecretarias } from '@/features/filtros';
import { SelectorPeriodo } from '@/features/filtros';
import { ChartSkeleton, KpiSkeleton } from '@/shared/components/ui';
import { useAuth } from '@/features/sesion/components/AuthProvider';
import { useContratos } from '@/features/contratos';
import { useCalificacionRiesgo } from '@/features/contratos';
import { fetchContratosSupervisados } from '@/features/contratos';
import { useContractAnalytics } from '@/features/analitica';
import { useDebouncedValue } from '@/shared/hooks';
import { aniosDisponibles, buildCuentasSecretaria, contratoEnAnios, contratoEnRango, corteEfectivo, periodoFiltroLabel, secretariasDisponibles, } from '@/features/cuentas';
import { buildCuentasDetalle, descargarCuentasExcel } from '@/features/cuentas';
import { buildLeadTime, formatDuracion } from '@/features/analitica';
import { ALCANCES_CUENTAS, contratoEnAlcance, contratosEnAlcance, contratoEnOps, OPCIONES_OPS } from '@/features/cuentas';
import { descargarLeadTimeExcel } from '@/features/analitica';
import { descargarSupervisoresExcel } from '@/features/contratos';
import { buildContratosPorSupervisor } from '@/features/contratos';
import { formatDate, formatMoneda, formatNumber, formatPercent, normalizar, truncate, } from '@/shared/utils';
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
    const [periodo, setPeriodo] = useState({ desde: '', hasta: '' });
    const [mes] = useState('todos');
    const [mesHasta] = useState('');
    const [exportando, setExportando] = useState(false);
    const [exportandoSupervisor, setExportandoSupervisor] = useState(false);
    const [exportandoLead, setExportandoLead] = useState(false);
    const [alcanceCuentas, setAlcanceCuentas] = useState('curso');
    const [ops, setOps] = useState('todas');
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
    const aplicarPeriodo = (rango) => {
        setPeriodo(rango);
    };
    // El único filtro de tiempo es el período: sin rango se mide todo el
    // histórico y con rango, los años que cubre ese rango.
    const aniosSeleccionados = useMemo(() => {
        const anios = [periodo.desde, periodo.hasta]
            .filter(Boolean)
            .map((valor) => Number(valor.slice(0, 4)))
            .filter((valor) => Number.isFinite(valor));
        return [...new Set(anios)].sort((a, b) => b - a);
    }, [periodo]);
    const opcionesAnio = useMemo(() => [...new Set([hoy.getFullYear(), ...(data ? aniosDisponibles(data) : [])])].sort((a, b) => b - a), [data, hoy]);
    const opcionesSecretaria = useMemo(() => (data ? secretariasDisponibles(data) : []), [data]);
    const opcionesAlcanceCuentas = useMemo(() => ALCANCES_CUENTAS.map((opcion) => ({ value: opcion.valor, label: opcion.label })), []);
    const contratosFiltrados = useMemo(() => (data ?? []).filter((contrato) => contratoEnAnios(contrato, aniosSeleccionados)
        && contratoEnRango(contrato, periodo.desde, periodo.hasta)
        && contratoEnOps(contrato, ops)), [data, aniosSeleccionados, periodo, ops]);
    // El alcance de cuentas recorta el universo que se mide en toda la página.
    const contratosVisibles = useMemo(() => contratosEnAlcance(contratosFiltrados, alcanceCuentas), [contratosFiltrados, alcanceCuentas]);
    const analytics = useContractAnalytics(data ? contratosVisibles : null);
    const anio = aniosSeleccionados.length ? Math.max(...aniosSeleccionados) : hoy.getFullYear();
    const filtrosCuentas = useMemo(() => ({ anio, anios: aniosSeleccionados, mes, mesHasta, desdeFecha: periodo.desde, hastaFecha: periodo.hasta, secretarias, situacion, alcance, soloDeuda, estado: estadoGrupo, texto: textoCuentaFiltrado, }), [anio, aniosSeleccionados, mes, mesHasta, periodo.desde, periodo.hasta, secretarias, situacion, alcance, soloDeuda, estadoGrupo, textoCuentaFiltrado]);
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
                && contratoEnAnios(item, aniosSeleccionados) && contratoEnRango(item, periodo.desde, periodo.hasta) && contratoEnAlcance(item, alcanceCuentas));
        if (!adicionales.length) return supervisorSeleccionado;
        return {
            ...supervisorSeleccionado,
            value: supervisorSeleccionado.value + adicionales.length,
            alDia: supervisorSeleccionado.alDia + adicionales.reduce((sum, item) => sum + Math.min(item.cuentasRegistradas ?? 0, item.cuentasExigibles ?? 0), 0),
            represadas: supervisorSeleccionado.represadas + adicionales.reduce((sum, item) => sum + (item.cuentasEnMora ?? 0), 0),
            contratos: [...supervisorSeleccionado.contratos, ...adicionales],
        };
    }, [supervisorSeleccionado, rol, secretariasSesion, contratosSupervisadosQuery.data, aniosSeleccionados, periodo.desde, periodo.hasta, alcanceCuentas]);
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
    const calificacionRiesgoQuery = useCalificacionRiesgo();
    // La comparativa entre secretarías la arma el backend sobre el índice en memoria, con el
    // mismo período y alcance de cuentas que miden el resto de la página.
    const comparativaQuery = useComparativaSecretarias({
        anios: aniosSeleccionados,
        desde: periodo.desde,
        hasta: periodo.hasta,
        alcance: alcanceCuentas,
        ops,
    });
    // La calificación y el riesgo son del contratista, así que se miden sobre los contratos
    // del año seleccionado, no sobre el estado de la cuenta de cobro.
    const calificacionRiesgo = useMemo(() => {
        const universo = new Set(contratosFiltrados.map((contrato) => contrato.noContrato));
        return buildCalificacionRiesgo(calificacionRiesgoQuery.data, universo);
    }, [calificacionRiesgoQuery.data, contratosFiltrados]);
    /** Suma del valor total de los contratos del universo: presupuesto, no cuentas de cobro. */
    const presupuesto = useMemo(() => {
        let total = 0;
        let conValor = 0;
        for (const contrato of contratosVisibles) {
            if (contrato.valorTotal === null || contrato.valorTotal === undefined) {
                continue;
            }
            const valor = Number(contrato.valorTotal);
            if (Number.isFinite(valor)) {
                total += valor;
                conValor += 1;
            }
        }
        return { total, conValor };
    }, [contratosVisibles]);
    // Los enlaces al listado arrastran el universo medido en esta página (años y
    // alcance de cuentas) para que el listado muestre los mismos contratos.
    const enlaceListado = (extra) => {
        const params = new URLSearchParams(extra);
        if (aniosSeleccionados.length > 0)
            params.set('anios', aniosSeleccionados.join(','));
        params.set('alcance', alcanceCuentas);
        return `/contratos?${params.toString()}`;
    };
    if (isLoading) {
        return (<div className="pila-pagina-amplia">
          <PageHeader eyebrow="Analítica" title="Analítica" description="Consolidando la información de contratos…"/>
          <div className="kpi-cuadricula kpi-cuadricula-tres">
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
      <PageHeader eyebrow="Analítica" title="Analítica" description={`Seguimiento de contratos · ${formatNumber(contratosVisibles.length)} registros activos`} actions={puede('TIEMPO_REAL_VER') ? (<Link to="/tiempo-real" className="cta-pagina">
          <Activity/>
          Monitor CDC
        </Link>) : null}/>

      <div className="filtro-fila filtro-fila-periodo-global">
        <SelectorPeriodo desde={periodo.desde} hasta={periodo.hasta} onChange={aplicarPeriodo} anios={opcionesAnio} etiqueta="Período"/>
        <div className="campo-filtro" title="«En curso» (por defecto) mide solo las cuentas que siguen abiertas; «Cerradas» solo las ya cerradas (estado 19); «Ambas» une los dos universos. Cambia el universo de cuentas de toda la página.">
          <Desplegable valor={alcanceCuentas} opciones={opcionesAlcanceCuentas} onChange={setAlcanceCuentas} className="pilla-filtro-campo"/>
        </div>
        <div className="campo-filtro" title="Las OPS son los contratos cuya tercera sigla del número es PSA o PSP (STD-CD-PSA, STD-CD-PSP). «Solo OPS» muestra únicamente esas; «Sin OPS» las excluye.">
          <Desplegable valor={ops} opciones={OPCIONES_OPS} onChange={setOps} className="pilla-filtro-campo"/>
        </div>
        <span className="texto-apoyo">Estos filtros aplican a todos los indicadores, gráficas y tablas de esta página.</span>
      </div>

      <div className="kpi-cuadricula kpi-cuadricula-tres">
        <KpiCard label="Presupuesto total" value={formatMoneda(presupuesto.total)} hint={`Valor de ${formatNumber(presupuesto.conValor)} contratos`} to={enlaceListado('')} title="Ver en el listado los contratos del universo medido"/>
        <KpiCard label="Cobertura" value={formatPercent(supervision.cobertura, 1)} hint={`${formatNumber(supervision.conSupervision)} contratos con supervisión`} footer={<ProgressBar value={supervision.cobertura} size="sm"/>} to={enlaceListado('supervision=con')} title="Ver en el listado los contratos con al menos un registro de supervisión"/>
        <KpiCard label="Con supervisión" value={formatNumber(supervision.conSupervision)} hint="Al menos un registro" to={enlaceListado('supervision=con')} title="Ver en el listado los contratos con al menos un registro de supervisión"/>
        <KpiCard label="Sin supervisión" value={formatNumber(supervision.sinSupervision)} hint="Sin ningún registro" destacada to={enlaceListado('supervision=sin')} title="Ver en el listado los contratos que no tienen ninguna supervisión registrada"/>
        <KpiCard label="Avance certificado" value={formatPercent(supervision.promedioAvanceSupervisados, 1)} hint={`Promedio de ${formatNumber(supervision.conSupervision)} supervisados · solo ${formatNumber(kpis.informesCargados)} con cuenta radicada`} footer={<ProgressBar value={supervision.promedioAvanceSupervisados} size="sm"/>} to={enlaceListado('supervision=con&orden=avance-asc')} title="Ver en el listado los contratos supervisados con el menor avance declarado"/>
        <KpiCard label="Informes cargados" value={formatNumber(kpis.informesCargados)} hint={`${informesPct > 0 && informesPct < 0.1 ? '<0,1%' : formatPercent(informesPct, 1)} del total`} to={enlaceListado('informe=cargado')} title="Ver en el listado los contratos con informe de actividades cargado"/>
      </div>

      <div className="cuadricula-panel">
        <ChartCard className="celda-col-corta" title="Estado de cuentas" contador={estadoCuentas.total} subtitle="Contratos en proceso frente a los que están en devolución o rechazados.">
          <EstadoCuentasDonut enProceso={estadoCuentas.enProceso} devolucionRechazo={estadoCuentas.devolucionRechazo} pctEnProceso={estadoCuentas.pctEnProceso}/>
        </ChartCard>

        <ChartCard className="celda-col-grande" title="Cuentas por secretaría" contador={cuentasSecretaria.rows.length} subtitle="Completadas = informes registrados; pendientes = cuotas mensuales vencidas sin informe. Corte al período seleccionado, sin proyectar cuotas futuras." action={<CuentasLegend />} footer={<p className="pie-analitico">
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

        <ChartCard className="celda-col-completa" title="Contratos por supervisor" contador={contratosPorSupervisor.supervisores} subtitle="Carga de cada supervisor: se toma el de la última supervisión registrada en cada contrato. Selecciona una barra para ver sus contratos y las cuentas a tiempo o represadas." footer={<p className="pie-analitico">
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
          <CardHeader title="Calificación y riesgo" subtitle="Nivel de calificación del contratista y riesgo de incumplimiento de la última supervisión." action={<Link to={enlaceListado('supervision=con')} className="link link-inline">
                Ver todos
                <ArrowUpRight/>
              </Link>}/>
          {calificacionRiesgoQuery.isError ? (<EmptyState icon={Search} title="Sin dato de calificación" description="No se pudo consultar la calificación y el riesgo de los contratistas."/>) : (<CalificacionRiesgoPanel
              datos={calificacionRiesgo}
              alVerContrato={(noContrato) => navigate(`/contratos/${encodeURIComponent(noContrato)}`)}
            />)}
        </Card>

        <Card className="celda-col-completa">
          <CardHeader title="Menor avance declarado" subtitle="Lo que registró el supervisor en su última visita; sin cuenta radicada no hay avance certificado." action={<Link to={enlaceListado('orden=avance-asc')} className="link link-inline">
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

      {puede('CONTRATOS_COMPARAR_SECRETARIAS') ? (<ComparativaSecretarias
          filas={comparativaQuery.data ?? []}
          misSecretarias={secretariasSesion}
          contratos={contratosFiltrados}
          alcance={alcanceCuentas}
          filtros={filtrosCuentas}
          hoy={hoy}
          cargando={comparativaQuery.isLoading}
          error={comparativaQuery.isError}
          onReintentar={() => comparativaQuery.refetch()}
        />) : null}

      {supervisorSeleccionado ? (<SupervisorContratosModal supervisor={detalleSupervisor} onClose={() => setSupervisorSeleccionado(null)}/>) : null}
      </div>);
}
