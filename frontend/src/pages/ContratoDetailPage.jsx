import { Activity, ArrowLeft, Check, ClipboardCheck, Copy, FileText, TrendingUp, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { FlujoCuenta } from '@/components/FlujoCuenta';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { useCdc } from '@/hooks/useCdc';
import { useContratos } from '@/hooks/useContratos';
import { useReporte } from '@/hooks/useReporte';
import { formatDate, formatDateTime, formatNumber, formatPercent, } from '@/lib/format';
import { parseReport } from '@/lib/report';
const FINANCIAL_SECTION = /^(ras|pagos?|financier)/i;
const FINANCIAL_ROW = /^(valor|facturad|saldo|fondos|total pagado)/i;
function InfoBlock({ label, value }) {
    return (<div className="info-bloque">
      <p className="micro-label">{label}</p>
      <div className="info-bloque-valor">{value}</div>
    </div>);
}
function liveRows(estado) {
    const rows = [];
    const push = (label, value) => {
        if (value === undefined || value === null || value === '')
            return;
        rows.push({ label, value });
    };
    push('Estado', estado.estado);
    push('Detalle', estado.detalle_estado);
    push('Fecha del estado', estado.fecha_estado ? formatDateTime(estado.fecha_estado) : undefined);
    push('Avance declarado (supervisión)', typeof estado.porcentaje_avance === 'number' ? formatPercent(estado.porcentaje_avance, 0) : undefined);
    push('Avance general', typeof estado.avance_general_contrato === 'number'
        ? formatPercent(estado.avance_general_contrato, 0)
        : undefined);
    push('Siguiente paso', estado.siguiente_paso);
    push('Cuenta de cobro actual', typeof estado.cuenta_cobro_actual === 'number' ? formatNumber(estado.cuenta_cobro_actual) : undefined);
    push('Última supervisión', typeof estado.ultima_supervision === 'number' ? formatNumber(estado.ultima_supervision) : undefined);
    push('Cuentas aprobadas', typeof estado.cuentas_aprobadas === 'number' && typeof estado.total_cuentas_cobro === 'number'
        ? `${estado.cuentas_aprobadas} de ${estado.total_cuentas_cobro}`
        : undefined);
    push('En firme', typeof estado.en_firme === 'boolean' ? (estado.en_firme ? 'Sí' : 'No') : undefined);
    return rows;
}
export function ContratoDetailPage() {
    const { noContrato = '' } = useParams();
    const { data: contratos, isLoading: loadingContratos } = useContratos();
    const reporte = useReporte(noContrato);
    const { events, status } = useCdc();
    const [copied, setCopied] = useState(false);
    const contrato = useMemo(() => contratos?.find((item) => item.noContrato === noContrato), [contratos, noContrato]);
    const liveEvents = useMemo(() => events.filter((event) => event.contrato === noContrato), [events, noContrato]);
    const liveState = liveEvents[0]?.estado ?? null;
    const parsed = useMemo(() => (reporte.data ? parseReport(reporte.data) : null), [reporte.data]);
    const secciones = useMemo(() => parsed?.sections
        .filter((section) => !FINANCIAL_SECTION.test(section.title))
        .map((section) => ({
        ...section,
        rows: section.rows.filter((row) => !FINANCIAL_ROW.test(row.label)),
    }))
        .filter((section) => section.rows.length > 0 || section.notes.length > 0) ?? [], [parsed]);
    const notFound = !loadingContratos &&
        !contrato &&
        (reporte.isError ||
            (reporte.data ? /contrato no encontrado/i.test(reporte.data) : false));
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        }
        catch {
            setCopied(false);
        }
    };
    if (!noContrato) {
        return (<Card>
        <EmptyState icon={FileText} title="Contrato no especificado" description="Selecciona un contrato desde el explorador para ver su detalle." action={<Link to="/contratos" className="btn btn-primary">
              Ir al explorador
            </Link>}/>
      </Card>);
    }
    if (loadingContratos) {
        return (<div className="pila-pagina-amplia">
        <PageHeader eyebrow="Detalle del contrato" title={noContrato}/>
        <TableSkeleton rows={6}/>
      </div>);
    }
    if (notFound) {
        return (<div className="pila-pagina-amplia">
        <Link to="/contratos" className="enlace-volver">
          <ArrowLeft/>
          Volver a contratos
        </Link>
        <Card>
          <EmptyState icon={FileText} title="Contrato no encontrado" description={`No existe información para el contrato ${noContrato}.`} action={<Link to="/contratos" className="btn btn-primary">
                Ver todos los contratos
              </Link>}/>
        </Card>
      </div>);
    }
    if (reporte.isError && !contrato) {
        return (<div className="pila-pagina-amplia">
        <PageHeader eyebrow="Detalle del contrato" title={noContrato}/>
        <ErrorState title="No fue posible obtener el reporte" message="El backend no respondió con el detalle de este contrato." onRetry={() => reporte.refetch()}/>
      </div>);
    }
    const avance = contrato?.porcentajeAvance ?? 0;
    const avanceDeclarado = contrato?.avanceDeclarado ?? 0;
    const estadoId = contrato?.idEstadoActual ?? liveState?.id_estado ?? 0;
    const estadoNombre = contrato?.estadoActual ?? liveState?.estado ?? null;
    const eventosDelContrato = liveEvents.slice(0, 12);
    const filasEstado = liveState ? liveRows(liveState) : [];
    const cuentas = liveState?.cuentas_cobro ?? [];
    return (<div className="pila-pagina-amplia">
      <Link to="/contratos" className="enlace-volver">
        <ArrowLeft/>
        Volver a contratos
      </Link>

      <PageHeader eyebrow="Detalle del contrato" title={noContrato} description={contrato?.contratista ?? 'Contratista no disponible'} actions={<>
            <Badge tone={status === 'connected' ? 'success' : status === 'connecting' ? 'warning' : 'danger'} dot>
              {status === 'connected'
                ? 'CDC conectado'
                : status === 'connecting'
                    ? 'Conectando CDC'
                    : 'CDC desconectado'}
            </Badge>
            <button type="button" className="btn btn-ghost" onClick={handleCopy}>
              {copied ? <Check className="check-copiado"/> : <Copy/>}
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
          </>}/>

      <div className="kpi-cuadricula kpi-cuadricula-cuatro">
        <KpiCard label="Avance certificado" value={formatPercent(avance, 0)} hint={avance === 0 && avanceDeclarado > 0
            ? `Declarado por el supervisor: ${formatPercent(avanceDeclarado, 0)} · sin cuenta radicada`
            : `${contrato?.totalSupervisiones ?? 0} supervisiones registradas`} icon={TrendingUp} tone="violet" footer={<ProgressBar value={avance} size="sm"/>}/>
        <KpiCard label="Estado actual" value={<EstadoBadge id={estadoId} label={estadoNombre}/>} hint={contrato?.fechaEstado ? `Actualizado ${formatDateTime(contrato.fechaEstado)}` : 'Sin fecha de estado'} icon={ClipboardCheck} tone="amber"/>
        <KpiCard label="Cuentas de cobro" value={`${formatNumber(contrato?.cuentasRegistradas ?? 0)} / ${formatNumber(contrato?.cuentasEsperadas ?? 0)}`} hint={`${formatNumber(contrato?.cuentasExigibles ?? 0)} exigibles · ${formatNumber(contrato?.cuentasEnMora ?? 0)} en mora`} icon={FileText} tone={(contrato?.cuentasEnMora ?? 0) > 0 ? 'rose' : 'slate'}/>
        <KpiCard label="Fecha de terminación" value={formatDate(contrato?.fechaFin)} hint={contrato?.fechaInicio ? `Inició ${formatDate(contrato.fechaInicio)}` : undefined} icon={Activity} tone="slate"/>
      </div>

      <FlujoCuenta cuentas={contrato?.cuentasDetalle ?? []}/>

      <Card>
          <CardHeader title="Estado en vivo" subtitle="Información recibida por WebSocket desde Debezium." action={<Badge tone={liveState ? 'success' : 'neutral'} dot={Boolean(liveState)}>
                {liveState ? 'Con cambios' : 'Sin cambios'}
              </Badge>}/>
          <div className="card-body">
            {!liveState ? (<div className="caja-vacia">
                <Activity/>
                <p className="caja-vacia-titulo">Esperando cambios</p>
                <p className="caja-vacia-detalle">
                  Cuando se actualice una tabla monitoreada para este contrato, el estado aparecerá aquí.
                </p>
              </div>) : (<div className="pila-datos">
                <div className="datos-dos-columnas">
                  {filasEstado.map((fila) => (<InfoBlock key={fila.label} label={fila.label} value={fila.value}/>))}
                </div>

                {cuentas.length > 0 ? (<div>
                    <p className="micro-label micro-label-encabezado">
                      Cuentas de cobro
                    </p>
                    <div className="tabla-envuelta">
                      <table className="tabla-interna">
                        <thead>
                          <tr>
                            <th className="table-th table-th-compacta">Informe</th>
                            <th className="table-th table-th-compacta">Estado</th>
                            <th className="table-th table-th-compacta table-th-derecha">Avance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuentas.map((cuenta) => (<tr key={cuenta.id_informe_actividad}>
                              <td className="table-td table-td-compacta table-td-min">
                                {cuenta.id_informe_actividad}
                              </td>
                              <td className="table-td table-td-compacta table-td-min">
                                {cuenta.estado || `Estado ${cuenta.id_estado}`}
                              </td>
                              <td className="table-td table-td-compacta table-td-min table-td-derecha cifra">
                                {formatPercent(cuenta.avance_individual, 0)}
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>) : null}
              </div>)}
          </div>
      </Card>

      <Card>
        <CardHeader title="Reporte del contrato" subtitle="Informe generado por el backend a partir de la supervisión y la trazabilidad del contrato."/>

        {reporte.isLoading ? (<div className="reporte-cargando">
            <div className="reporte-trazo reporte-trazo-uno"/>
            <div className="reporte-trazo reporte-trazo-dos"/>
            <div className="reporte-trazo reporte-trazo-tres"/>
          </div>) : reporte.isError ? (<div className="card-body">
            <ErrorState title="Reporte no disponible" message="No fue posible obtener el reporte desde el backend." onRetry={() => reporte.refetch()}/>
          </div>) : (<div className="reporte-grid">
            {secciones.map((section) => (<div key={section.title} className="reporte-seccion">
                <h3 className="reporte-seccion-titulo">
                  {section.title}
                </h3>
                {section.rows.length > 0 ? (<dl className="reporte-lista">
                    {section.rows.map((row, index) => (<div key={`${row.label}-${index}`} className="reporte-fila">
                        <dt className="reporte-clave">{row.label}</dt>
                        <dd className="reporte-valor">
                          {row.value}
                        </dd>
                      </div>))}
                  </dl>) : null}
                {section.notes.map((note, index) => (<p key={`${note}-${index}`} className="reporte-nota">
                    {note}
                  </p>))}
              </div>))}
          </div>)}
      </Card>

      <Card>
        <CardHeader title="Eventos CDC del contrato" subtitle="Cambios recientes capturados en esta sesión para este número de contrato." action={<Badge tone="info">{formatNumber(liveEvents.length)}</Badge>}/>
        {eventosDelContrato.length === 0 ? (<EmptyState icon={Activity} title="Sin eventos recientes" description="Los cambios aparecerán aquí a medida que Debezium los transmita."/>) : (<ol className="lista-dividida">
            {eventosDelContrato.map((event, index) => (<li key={`${event.timestamp}-${index}`} className="fila-evento">
                <span className="evento-punto evento-punto-marca"/>
                <span className="fila-evento-tipo">{event.tipo}</span>
                <Badge tone="neutral">{event.tabla}</Badge>
                <span className="fila-evento-estado">{event.estado.estado ?? '—'}</span>
                <span className="fila-evento-hora">
                  {formatDateTime(event.timestamp)}
                </span>
              </li>))}
          </ol>)}
      </Card>
    </div>);
}
