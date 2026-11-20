import { Activity, ArrowLeft, Check, ClipboardCheck, Copy, DollarSign, FileText, TrendingUp, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/shared/components/ui';
import { FlujoCuenta } from '@/features/cuentas';
import { Card, CardHeader } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/ui';
import { ErrorState } from '@/shared/components/ui';
import { EstadoBadge } from '@/features/cuentas';
import { KpiCard } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui';
import { ProgressBar } from '@/shared/components/ui';
import { TableSkeleton } from '@/shared/components/ui';
import { useCdc } from '@/features/cdc';
import { useContratos } from '@/features/contratos';
import { useReporte, useValorContrato, useAdicion } from '@/features/contratos';
import { useAuth } from '@/features/sesion/components/AuthProvider';
import { formatDate, formatDateTime, formatNumber, formatPercent, } from '@/shared/utils';
import { parseReport } from '@/features/contratos';
const FINANCIAL_SECTION = /^(ras|pagos?|financier)/i;
const FINANCIAL_ROW = /^(valor|facturad|saldo|fondos|total pagado)/i;
const FORMATO_MONEDA = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});
/** La calificación y el riesgo se leen de un vistazo: cada nivel tiene su color. */
const TONO_CALIFICACION = { A: 'success', B: 'info', C: 'warning', D: 'danger' };
const TONO_RIESGO = { Alto: 'danger', Medio: 'warning', Bajo: 'info', Ninguno: 'success' };
function valorReporte(row) {
    if (row.label.startsWith('Calificación')) {
        const nivel = row.value.split('·')[0].trim();
        return (<Badge tone={TONO_CALIFICACION[nivel] ?? 'neutral'}>
            {row.value}
          </Badge>);
    }
    if (row.label.startsWith('Riesgo de incumplimiento')) {
        return (<Badge tone={TONO_RIESGO[row.value.trim()] ?? 'neutral'}>
            {row.value}
          </Badge>);
    }
    return row.value;
}
export function ContratoDetailPage() {
    const { noContrato = '' } = useParams();
    const { rol } = useAuth();
    const { data: contratos, isLoading: loadingContratos } = useContratos();
    const reporte = useReporte(noContrato);
    const valorContrato = useValorContrato(noContrato);
    const adicion = useAdicion(noContrato);
    const { events, status } = useCdc();
    const [copied, setCopied] = useState(false);
    const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
    const contrato = useMemo(() => contratos?.find((item) => item.noContrato === noContrato), [contratos, noContrato]);
    const cuentasDetalle = contrato?.cuentasDetalle ?? [];
    const cuentaVigente = useMemo(() => {
        if (cuentasDetalle.length === 0)
            return null;
        return (cuentaSeleccionada !== null
            ? cuentasDetalle.find((item) => item.idInformeActividad === cuentaSeleccionada)
            : undefined) ?? cuentasDetalle.find((item) => item.activa) ?? cuentasDetalle[0];
    }, [cuentasDetalle, cuentaSeleccionada]);
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
    const filasAdicion = useMemo(() => {
        const dato = adicion.data;
        if (!dato) {
            return [];
        }
        const valor = Number.isFinite(dato.valorAdicion) ? dato.valorAdicion : 0;
        const facturado = Number.isFinite(dato.facturadoAdicion) ? dato.facturadoAdicion : 0;
        const saldo = Number.isFinite(dato.saldoAdicion) ? dato.saldoAdicion : Math.max(valor - facturado, 0);
        const filas = [
            { label: 'Valor de la adición', value: FORMATO_MONEDA.format(valor) },
            { label: 'Facturado de la adición', value: FORMATO_MONEDA.format(facturado) },
            { label: 'Saldo de la adición', value: FORMATO_MONEDA.format(saldo) },
            { label: 'Plazo de ejecución final', value: dato.plazoEjecucionFinal?.trim() || '—' },
            { label: 'Prórrogas registradas', value: formatNumber(dato.cantidadProroga ?? 0) },
        ];
        if (Number.isFinite(dato.duracionDias)) {
            filas.push({
                label: 'Duración de la vigencia',
                value: `${formatNumber(dato.duracionDias)} días · ${formatDate(dato.fechaInicio)} → ${formatDate(dato.fechaFin)}`,
            });
        }
        filas.push({ label: 'Actualizado en Supervisa', value: formatDateTime(dato.fechaActualizacion) });
        return filas;
    }, [adicion.data]);
    const notFound = !loadingContratos &&
        !contrato &&
        (reporte.isError ||
            (reporte.data ? /contrato no encontrado/i.test(reporte.data) : false));
    // El backend recorta el listado al alcance del usuario: si el contrato no esta ahi,
    // no es visible para esta persona (403 en el detalle).
    const alcanceRecortado = rol?.codigo === 'SUPERVISOR' || rol?.codigo === 'BASICO';
    const fueraDeAlcance = reporte.error?.status === 403 ||
        valorContrato.error?.status === 403 ||
        (alcanceRecortado && Boolean(contratos) && !contrato && !(reporte.data ? /contrato no encontrado/i.test(reporte.data) : false));
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
    if (fueraDeAlcance) {
        return (<div className="pila-pagina-amplia">
          <Link to="/contratos" className="enlace-volver">
            <ArrowLeft/>
            Volver a contratos
          </Link>
          <Card>
            <EmptyState icon={FileText} title="Fuera de tu alcance" description={`El contrato ${noContrato} no hace parte de los contratos asignados a tu supervision.`} action={<Link to="/contratos" className="btn btn-primary">
                  Ver mis contratos
                </Link>}/>
          </Card>
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

      <div className="kpi-cuadricula kpi-cuadricula-cinco">
        <KpiCard label="Avance total del contrato" value={formatPercent(avance, 0)} hint={avance === 0 && avanceDeclarado > 0
            ? `Declarado por el supervisor: ${formatPercent(avanceDeclarado, 0)} · sin cuenta radicada`
            : `${formatNumber(contrato?.totalSupervisiones ?? 0)} supervisiones registradas`} icon={TrendingUp} tone="violet" footer={<ProgressBar value={avance} size="sm"/>}/>
        <KpiCard label={cuentaVigente ? 'Estado de la cuenta en trámite' : 'Estado actual'} value={<EstadoBadge id={cuentaVigente ? cuentaVigente.idEstadoActual : estadoId} label={cuentaVigente ? cuentaVigente.estadoActual : estadoNombre}/>} hint={cuentaVigente
          ? `${cuentaVigente.noInforme !== null && cuentaVigente.noInforme !== undefined ? `Cuenta N.° ${cuentaVigente.noInforme}` : `Informe ${cuentaVigente.idInformeActividad}`}${cuentaVigente.fechaEstado ? ` · Actualizado ${formatDateTime(cuentaVigente.fechaEstado)}` : ''}`
          : contrato?.fechaEstado ? `Actualizado ${formatDateTime(contrato.fechaEstado)}` : 'Sin fecha de estado'} icon={ClipboardCheck} tone="amber"/>
        <KpiCard label="Cuentas de cobro" value={`${formatNumber(contrato?.cuentasRegistradas ?? 0)} / ${formatNumber(contrato?.cuentasEsperadas ?? 0)}`} hint={`${formatNumber(contrato?.cuentasExigibles ?? 0)} exigibles · ${formatNumber(contrato?.cuentasEnMora ?? 0)} en mora`} icon={FileText} tone={(contrato?.cuentasEnMora ?? 0) > 0 ? 'rose' : 'slate'}/>
        <KpiCard label="Fecha de terminación" value={formatDate(contrato?.fechaFin)} hint={contrato?.fechaInicio ? `Inició ${formatDate(contrato.fechaInicio)}` : undefined} icon={Activity} tone="slate"/>
        <KpiCard
          label="Valor del contrato"
          value={valorContrato.isLoading
            ? 'Consultando…'
            : Number.isFinite(valorContrato.data?.valorTotal)
              ? FORMATO_MONEDA.format(valorContrato.data.valorTotal)
              : 'No disponible'}
          hint="Valor registrado en Supervisa"
          icon={DollarSign}
          tone="emerald"
        />
      </div>

      <FlujoCuenta cuentas={cuentasDetalle} seleccionId={cuentaSeleccionada} onSeleccion={setCuentaSeleccionada}/>

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
                          {valorReporte(row)}
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
        <CardHeader title="Adición del contrato" subtitle="Datos de la adición registrados en Supervisa: si existe, cuánto vale, cuánto se ha facturado de ella y en qué plazo quedó." action={adicion.data ? (<Badge tone={adicion.data.tieneAdicion ? 'success' : 'neutral'}>{adicion.data.tieneAdicion ? 'Sí tiene adición' : 'Sin adición'}</Badge>) : null}/>
        {adicion.isLoading ? (<div className="reporte-cargando">
            <div className="reporte-trazo reporte-trazo-uno"/>
            <div className="reporte-trazo reporte-trazo-dos"/>
          </div>) : adicion.isError ? (<div className="card-body">
            <ErrorState title="Adición no disponible" message="No fue posible consultar la adición de este contrato." onRetry={() => adicion.refetch()}/>
          </div>) : !adicion.data ? (<EmptyState icon={FileText} title="Sin registro de adición" description="Para este contrato no hay información de adición en Supervisa."/>) : (<dl className="reporte-lista adicion-lista">
            {filasAdicion.map((fila) => (<div key={fila.label} className="reporte-fila">
                <dt className="reporte-clave">{fila.label}</dt>
                <dd className="reporte-valor">
                  {fila.value}
                </dd>
              </div>))}
            {!adicion.data.tieneAdicion ? (<p className="reporte-nota">
                Este contrato no tiene adición registrada: el valor de la adición es cero.
              </p>) : null}
          </dl>)}
      </Card>
      </div>);
}
