import { FileText, GitBranch, ListOrdered } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/shared/components/ui';
import { BurbujaAvance } from '@/features/cuentas/components/BurbujaAvance';
import { Card, CardHeader } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/ui';
import { EstadoBadge } from '@/features/cuentas/components/EstadoBadge';
import { FlujoCuentaDiagrama } from '@/features/cuentas/components/FlujoCuentaDiagrama';
import { FlujoCuentaLineaTiempo } from '@/features/cuentas/components/FlujoCuentaLineaTiempo';
import { avanceDeCuenta } from '@/features/cuentas/utils/avanceCuenta';
import { formatDate, formatDateTime } from '@/shared/utils';
import { ESTADO_APROBADO, estadoLabel } from '@/features/cuentas/utils/estados';

function Dato({ label, value }) {
  return (
    <div className="info-bloque info-bloque-plain">
      <p className="micro-label">{label}</p>
      <div className="info-bloque-valor">{value}</div>
    </div>
  );
}

export function FlujoCuenta({ cuentas, seleccionId, onSeleccion }) {
  const [seleccionLocal, setSeleccionLocal] = useState(null);
  const [vista, setVista] = useState('diagrama');
  const selectedId = seleccionId !== undefined ? seleccionId : seleccionLocal;
  const setSelectedId = onSeleccion ?? setSeleccionLocal;

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

  const avance = useMemo(() => avanceDeCuenta(cuenta, pasos), [cuenta, pasos]);
  const tonoAvance = avance.cerrado
    ? 'success'
    : avance.devuelta
      ? 'warning'
      : avance.pct >= 50
        ? 'success'
        : 'brand';

  useEffect(() => {
    setSelectedId(null);
  }, [cuentas.length]);

  return (
    <Card>
      <CardHeader
        title="Flujo de la cuenta en trámite"
        subtitle={
          vista === 'diagrama'
            ? 'Recorrido real de la cuenta sobre el proceso del contrato: cada parada numerada es la tarea que tocó. En verde lo que ya pasó, en rojo las devoluciones y en naranja el punto donde está hoy; con Reproducir se recorre parada por parada.'
            : 'Historial de la cuenta en el orden en que ocurrió: fecha, hora, estado y quién dejó la cuenta en ese punto. El estado actual va primero.'
        }
        action={
          cuenta ? (
            <div className="flujo-cabecera-acciones">
              <EstadoBadge id={cuenta.idEstadoActual} label={cuenta.estadoActual} />
              <div className="flujo-conmutador" role="group" aria-label="Forma de ver el flujo">
                <button
                  type="button"
                  aria-pressed={vista === 'diagrama'}
                  onClick={() => setVista('diagrama')}
                  className="flujo-conmutador-boton"
                >
                  <GitBranch size={13} aria-hidden="true" />
                  Diagrama
                </button>
                <button
                  type="button"
                  aria-pressed={vista === 'tiempo'}
                  onClick={() => setVista('tiempo')}
                  className="flujo-conmutador-boton"
                >
                  <ListOrdered size={13} aria-hidden="true" />
                  Línea de tiempo
                </button>
              </div>
            </div>
          ) : null
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

            <div className="flujo-avance">
              <BurbujaAvance pct={avance.pct} tono={tonoAvance} size={84} />
              <div className="flujo-avance-texto">
                <p className="micro-label">Avance de la cuenta</p>
                <p className="flujo-avance-hito">{avance.hitoActual}</p>
                <p className="flujo-avance-contador">
                  {avance.etapas} de {avance.total} etapas del recorrido
                </p>
              </div>
            </div>
          </div>

          {vista === 'diagrama' ? (
            <FlujoCuentaDiagrama pasos={pasos} enTramite={cuenta.activa !== false} />
          ) : (
            <FlujoCuentaLineaTiempo
              pasos={pasos}
              cuenta={cuenta}
            />
          )}

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
            <Dato
              label="Siguiente paso"
              value={
                cuenta.idEstadoActual === ESTADO_APROBADO
                  ? 'Proceso completado'
                  : (cuenta.siguientePaso ?? '—')
              }
            />
          </div>
        </div>
      )}
    </Card>
  );
}
