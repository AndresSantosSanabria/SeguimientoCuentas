import { Check, ChevronRight, FileText } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  ESTADO_APROBADO,
  ESTADO_DEVOLUCION,
  ESTADOS_RECHAZO,
  estadoLabel,
  estadoTone,
} from '@/lib/estados';

function tonoNodo(idEstado, esActual) {
  if (esActual) return 'actual';
  if (ESTADOS_RECHAZO.has(idEstado)) return 'danger';
  if (idEstado === ESTADO_DEVOLUCION) return 'warning';
  if (idEstado === ESTADO_APROBADO) return 'success';
  return estadoTone(idEstado);
}

function Dato({ label, value }) {
  return (
    <div className="info-bloque info-bloque-plain">
      <p className="micro-label">{label}</p>
      <div className="info-bloque-valor">{value}</div>
    </div>
  );
}

function Conector() {
  return (
    <div className="flujo-conector">
      <ChevronRight />
    </div>
  );
}

export function FlujoCuenta({ cuentas }) {
  const [selectedId, setSelectedId] = useState(null);
  const flowRef = useRef(null);
  const currentRef = useRef(null);
  const cuenta = useMemo(() => {
    if (cuentas.length === 0) return null;
    const explicit =
      selectedId !== null
        ? cuentas.find((item) => item.idInformeActividad === selectedId)
        : undefined;
    return explicit ?? cuentas.find((item) => item.activa) ?? cuentas[0];
  }, [cuentas, selectedId]);
  const pasos = useMemo(() => {
    if (!cuenta) return [];
    if (cuenta.pasos.length > 0) return cuenta.pasos;
    return [
      {
        idEstado: cuenta.idEstadoActual,
        estado: cuenta.estadoActual,
        fecha: cuenta.fechaEstado,
        descripcion: cuenta.descripcionEstado,
      },
    ];
  }, [cuenta]);
  useEffect(() => {
    const container = flowRef.current;
    const node = currentRef.current;
    if (!container || !node) return;
    const target = node.offsetLeft - container.clientWidth / 2 + node.clientWidth / 2;
    container.scrollLeft = Math.max(0, target);
  }, [cuenta?.idInformeActividad, pasos.length]);
  return (
    <Card>
      <CardHeader
        title="Flujo de la cuenta en trámite"
        subtitle="Recorrido real de la cuenta de cobro radicada. Las cuentas sin informe registrado no se muestran."
        action={
          cuenta ? <EstadoBadge id={cuenta.idEstadoActual} label={cuenta.estadoActual} /> : null
        }
      />

      {!cuenta ? (
        <EmptyState
          icon={FileText}
          title="Sin cuentas en trámite"
          description="Este contrato todavía no tiene cuentas de cobro registradas. El flujo aparecerá cuando se radique la primera."
        />
      ) : (
        <div className="card-body flujo-cuerpo">
          {cuentas.length > 1 ? (
            <div className="flujo-selector">
              <span className="micro-label">Cuentas registradas</span>
              {cuentas.map((item) => {
                const selected = item.idInformeActividad === cuenta.idInformeActividad;
                return (
                  <button
                    key={item.idInformeActividad}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(item.idInformeActividad)}
                    className="chip-cuenta"
                  >
                    <span>
                      {item.noInforme !== null
                        ? `Cuenta ${item.noInforme}`
                        : `Informe ${item.idInformeActividad}`}
                    </span>
                    <span className="chip-cuenta-sep">·</span>
                    <span className="chip-cuenta-estado">
                      {estadoLabel(item.idEstadoActual, item.estadoActual)}
                    </span>
                    {item.activa ? <span className="chip-cuenta-vivo">En trámite</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flujo-meta">
            <div>
              <p className="micro-label">
                {cuenta.activa ? 'Cuenta en trámite' : 'Cuenta registrada'}
              </p>
              <p className="flujo-meta-titulo">
                {cuenta.noInforme !== null
                  ? `Cuenta N.° ${cuenta.noInforme}`
                  : `Informe ${cuenta.idInformeActividad}`}
                {cuenta.numInforme ? (
                  <span className="flujo-meta-numero">Informe {cuenta.numInforme}</span>
                ) : null}
              </p>
            </div>
            <Badge tone="neutral">{cuenta.tipoInforme?.trim() || 'Informe de actividades'}</Badge>
            <Badge tone={cuenta.requiereSecop ? 'warning' : 'neutral'}>
              {cuenta.requiereSecop ? 'Requiere SECOP' : 'Sin SECOP'}
            </Badge>
            <Badge tone={cuenta.firmado ? 'success' : 'neutral'}>
              {cuenta.firmado ? 'Firmado' : 'Sin firma'}
            </Badge>
            <p className="flujo-meta-periodo">
              <span className="flujo-meta-periodo-leyenda">Periodo:</span>{' '}
              {formatDate(cuenta.fechaInicio)} – {formatDate(cuenta.fechaFin)}
            </p>
          </div>

          <div ref={flowRef} className="flujo-pista">
            <div className="flujo-cadena">
              {pasos.map((paso, index) => {
                const esActual = index === pasos.length - 1;
                return (
                  <Fragment key={`${paso.idEstado}-${index}`}>
                    {index > 0 ? <Conector /> : null}
                    <div
                      ref={esActual ? currentRef : undefined}
                      data-tone={tonoNodo(paso.idEstado, esActual)}
                      className="flujo-nodo"
                      title={paso.descripcion ?? undefined}
                    >
                      <div className="flujo-nodo-cabecera">
                        <span className="micro-label micro-label-min">Estado {paso.idEstado}</span>
                        {esActual ? (
                          <span className="flujo-nodo-vivo">
                            <span className="flujo-nodo-vivo-punto parpadeo" />
                            Actual
                          </span>
                        ) : (
                          <Check className="flujo-nodo-listo" />
                        )}
                      </div>
                      <p className="flujo-nodo-estado">
                        {estadoLabel(paso.idEstado, paso.estado)}
                      </p>
                      <p className="flujo-nodo-fecha">
                        {paso.fecha ? formatDate(paso.fecha) : 'Sin fecha'}
                      </p>
                    </div>
                  </Fragment>
                );
              })}

              {cuenta.siguientePaso && cuenta.idEstadoActual !== ESTADO_APROBADO ? (
                <>
                  <Conector />
                  <div className="flujo-nodo-siguiente">
                    <span className="micro-label micro-label-min">Siguiente</span>
                    <p className="flujo-nodo-estado flujo-nodo-estado-proximo">
                      {cuenta.siguientePaso}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="flujo-datos">
            <Dato
              label="Último movimiento"
              value={
                cuenta.descripcionEstado?.trim() ? (
                  <span>
                    {cuenta.descripcionEstado}
                    <span className="flujo-dato-detalle">{formatDateTime(cuenta.fechaEstado)}</span>
                  </span>
                ) : (
                  formatDateTime(cuenta.fechaEstado)
                )
              }
            />
            <Dato label="Siguiente paso" value={cuenta.siguientePaso ?? '—'} />
          </div>
        </div>
      )}
    </Card>
  );
}
