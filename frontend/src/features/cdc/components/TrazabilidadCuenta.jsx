import { DollarSign, FileText, Radio, UserRound } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import { Card, CardHeader } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/ui';
import { EstadoBadge } from '@/features/cuentas';
import { useValorContrato } from '@/features/contratos';
import { BLOQUES, etiquetaCuenta, rolDeEstado } from '@/features/cuentas';
import { formatDateTime, formatRelativeTime } from '@/shared/utils';

const FORMATO_MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function Dato({ label, value }) {
  return (
    <div className="trazabilidad-dato">
      <span className="trazabilidad-dato-label">{label}</span>
      <span className="trazabilidad-dato-valor">{value}</span>
    </div>
  );
}

/**
 * Panel derecho: qué cuenta es, en qué bloque está hoy, su valor, el último
 * salto de CDC, las ocho etapas del trámite y los eventos que lleva en vivo.
 */
export function TrazabilidadCuenta({ item, eventos }) {
  const noContrato = item?.contrato?.noContrato ?? '';
  const valor = useValorContrato(noContrato);

  if (!item) {
    return (
      <Card className="tarjeta-columna celda-col-corta">
        <CardHeader title="Trazabilidad de la Cuenta" subtitle="Selecciona una cuenta del bloque." />
        <EmptyState
          icon={FileText}
          title="Sin cuenta seleccionada"
          description="Elige una cuenta en curso o en devolución para ver su recorrido por los ocho bloques."
        />
      </Card>
    );
  }

  const { contrato, cuenta, clase } = item;
  const bloqueActual = BLOQUES.find((bloque) => bloque.id === clase.bloque);
  const eventosContrato = eventos.filter((evento) => evento.contrato === noContrato);
  const ultimoSalto = eventosContrato[0];
  const origen = rolDeEstado(clase.origen);
  const valorDatos = Number.isFinite(valor.data?.valorTotal)
    ? FORMATO_MONEDA.format(valor.data.valorTotal)
    : valor.isLoading
      ? 'Consultando…'
      : 'No disponible';

  return (
    <Card className="tarjeta-columna celda-col-corta">
      <CardHeader
        title="Trazabilidad de la Cuenta"
        subtitle="Dónde está la cuenta hoy y por qué bloques ya pasó."
        action={<Badge tone="info">{etiquetaCuenta(cuenta)}</Badge>}
      />

      <div className="card-body trazabilidad-cuerpo">
        <div className="trazabilidad-datos">
          <Dato label="Contratista" value={contrato?.contratista ?? '—'} />
          <Dato label="Contrato" value={contrato?.noContrato ?? '—'} />
          <Dato
            label="Bloque actual"
            value={
              bloqueActual ? (
                <span className="trazabilidad-bloque">
                  <span className="trazabilidad-bloque-numero">#{bloqueActual.numero}</span>
                  {bloqueActual.nombre}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Dato
            label="Estado del proceso"
            value={<EstadoBadge id={cuenta.idEstadoActual} label={cuenta.estadoActual} />}
          />
          <Dato
            label="Quién tiene la cuenta"
            value={
              cuenta.responsableActual?.trim() ? (
                <span className="trazabilidad-responsa">
                  <UserRound />
                  <span>
                    <strong>{cuenta.responsableActual}</strong>
                    {cuenta.rolResponsableActual?.trim() ? (
                      <span className="trazabilidad-detalle">{cuenta.rolResponsableActual}</span>
                    ) : null}
                  </span>
                </span>
              ) : (
                'Sin responsable registrado'
              )
            }
          />
          <Dato
            label="Valor total"
            value={
              <span className="trazabilidad-valor">
                <DollarSign />
                {valorDatos}
              </span>
            }
          />
          <Dato
            label="Último salto CDC"
            value={
              ultimoSalto ? (
                <span>
                  {ultimoSalto.estado?.estado ?? ultimoSalto.tipo}
                  <span className="trazabilidad-detalle">
                    {formatRelativeTime(ultimoSalto.timestamp)} · {formatDateTime(ultimoSalto.timestamp)}
                  </span>
                </span>
              ) : (
                'Sin movimientos en esta sesión'
              )
            }
          />
        </div>

        {clase.modo === 'devolucion' ? (
          <div className="trazabilidad-devolucion" data-modo="devolucion">
            <p className="trazabilidad-devolucion-titulo">
              En devolución {cuenta.fechaEstado ? formatDateTime(cuenta.fechaEstado) : ''}
            </p>
            <p className="trazabilidad-devolucion-detalle">
              {origen ? `Devuelto por ${origen}` : 'Origen de la devolución sin registro'}
              {cuenta.siguientePaso?.trim() ? ` · ${cuenta.siguientePaso}` : ''}
            </p>
          </div>
        ) : null}

        <div>
          <p className="micro-label micro-label-encabezado">
            Etapas del trámite (8 bloques)
          </p>
          <ol className="trazabilidad-etapas">
            {BLOQUES.map((bloque) => {
              const actual = bloque.id === clase.bloque;
              return (
                <li key={bloque.id} data-actual={actual ? 'si' : 'no'} className="trazabilidad-etapa">
                  <span className="trazabilidad-etapa-punto" aria-hidden="true" />
                  <span className="trazabilidad-etapa-numero">#{bloque.numero}</span>
                  <span className="trazabilidad-etapa-nombre">{bloque.nombre}</span>
                  {actual ? (
                    <span data-modo={clase.modo} className="trazabilidad-etapa-actual">
                      {clase.modo === 'devolucion' ? 'En devolución' : 'En curso'}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <p className="micro-label micro-label-encabezado">
            Eventos CDC en vivo{' '}
            <span className="trazabilidad-etapa-badge">
              <Radio /> WebSocket activo
            </span>
          </p>
          {eventosContrato.length > 0 ? (
            <ul className="trazabilidad-eventos">
              {eventosContrato.slice(0, 8).map((evento, indice) => (
                <li key={`${evento.timestamp}-${indice}`} className="trazabilidad-evento">
                  <span className="evento-punto evento-punto-marca" />
                  <span className="trazabilidad-evento-texto">
                    <strong>{evento.estado?.estado ?? evento.tipo}</strong>
                    <span className="trazabilidad-detalle">
                      {evento.estado?.descripcion ?? evento.tabla}
                    </span>
                  </span>
                  <span className="trazabilidad-evento-hora">{formatDateTime(evento.timestamp)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
