import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { Modal } from '@/components/ui/Modal';
import { cuentasAlDia, cuentasRepresadas } from '@/lib/supervisores';
import { formatDate, formatNumber } from '@/lib/format';

function Dato({ label, value, className = '' }) {
  return (
    <div className="info-bloque info-bloque-suave">
      <p className="micro-label">{label}</p>
      <p className={`info-bloque-valor-grande ${className}`}>{value}</p>
    </div>
  );
}

function DetalleContrato({ contrato }) {
  const alDia = cuentasAlDia(contrato);
  const represadas = cuentasRepresadas(contrato);
  const radicadas = contrato.cuentasDetalle ?? [];
  return (
    <div className="modal-supervisor-detalle">
      <div>
        <p className="modal-supervisor-numero">{contrato.noContrato}</p>
        <h3 className="modal-supervisor-nombre">{contrato.contratista}</h3>
        <div className="modal-supervisor-meta">
          <EstadoBadge id={contrato.idEstadoActual} label={contrato.estadoActual} />
          <span className="texto-apoyo">{contrato.dependencia ?? 'Sin secretaría'}</span>
          <Link
            to={`/contratos/${encodeURIComponent(contrato.noContrato)}`}
            className="link link-inline"
          >
            Ver contrato
            <ArrowUpRight />
          </Link>
        </div>
      </div>

      <div className="modal-supervisor-cifras">
        <Dato label="A tiempo" value={formatNumber(alDia)} className="dato-cifra-ok" />
        <Dato
          label="Represadas"
          value={formatNumber(represadas)}
          className={represadas > 0 ? 'dato-cifra-alerta' : ''}
        />
        <Dato label="Exigibles" value={formatNumber(contrato.cuentasExigibles ?? 0)} />
      </div>

      <p
        className={
          represadas > 0
            ? 'modal-supervisor-veredicto veredicto-malo'
            : 'modal-supervisor-veredicto veredicto-bueno'
        }
      >
        {represadas > 0 ? <AlertTriangle /> : <CheckCircle2 />}
        <span>
          {represadas > 0
            ? `Acumula ${formatNumber(represadas)} ${represadas === 1 ? 'cuenta vencida' : 'cuentas vencidas'} sin radicar, de ${formatNumber(contrato.cuentasExigibles ?? 0)} exigibles a la fecha.`
            : `Sin cuentas vencidas: sus ${formatNumber(contrato.cuentasRegistradas ?? 0)} ${contrato.cuentasRegistradas === 1 ? 'cuenta radicada' : 'cuentas radicadas'} están al día.`}
        </span>
      </p>

      {radicadas.length > 0 ? (
        <div>
          <p className="micro-label micro-label-encabezado">Cuentas radicadas</p>
          <div className="modal-supervisor-cuentas">
            <table className="tabla-interna">
              <thead>
                <tr>
                  <th className="table-th table-th-compacta">Período</th>
                  <th className="table-th table-th-compacta">Estado</th>
                  <th className="table-th table-th-compacta">Siguiente paso</th>
                </tr>
              </thead>
              <tbody>
                {radicadas.map((cuenta) => (
                  <tr key={cuenta.idInformeActividad}>
                    <td className="table-td table-td-compacta celda-periodo">
                      {formatDate(cuenta.fechaInicio)} – {formatDate(cuenta.fechaFin)}
                    </td>
                    <td className="table-td table-td-compacta">
                      <EstadoBadge id={cuenta.idEstadoActual} label={cuenta.estadoActual} />
                    </td>
                    <td className="table-td table-td-compacta texto-apoyo">
                      {cuenta.siguientePaso ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="modal-supervisor-vacio">Este contratista no ha radicado cuentas de cobro.</p>
      )}
    </div>
  );
}

export function SupervisorContratosModal({ supervisor, onClose }) {
  const contratos = supervisor?.contratos ?? [];
  const [seleccionado, setSeleccionado] = useState(0);
  useEffect(() => setSeleccionado(0), [supervisor?.label]);
  const actual = contratos[Math.min(seleccionado, Math.max(0, contratos.length - 1))];
  return (
    <Modal
      title={supervisor?.label ?? ''}
      subtitle={`${formatNumber(supervisor?.value ?? 0)} contratos · ${formatNumber(supervisor?.alDia ?? 0)} cuentas a tiempo · ${formatNumber(supervisor?.represadas ?? 0)} represadas`}
      onClose={onClose}
      className="modal-panel-ancha"
    >
      <div className="modal-supervisor">
        <div>
          <p className="micro-label micro-label-encabezado">Contratistas asignados</p>
          <ul className="modal-supervisor-lista">
            {contratos.map((contrato, index) => {
              const represadas = cuentasRepresadas(contrato);
              return (
                <li key={contrato.noContrato ?? index}>
                  <button
                    type="button"
                    onClick={() => setSeleccionado(index)}
                    aria-pressed={index === seleccionado}
                    className="fila-contratista"
                  >
                    <span className="fila-contratista-texto">
                      <span className="fila-contratista-nombre">{contrato.contratista}</span>
                      <span className="fila-contratista-dep">
                        {contrato.dependencia ?? 'Sin secretaría'}
                      </span>
                    </span>
                    <span
                      className={
                        represadas > 0
                          ? 'fila-contratista-marca fila-contratista-marca-mala'
                          : 'fila-contratista-marca fila-contratista-marca-buena'
                      }
                    >
                      {represadas > 0 ? `${formatNumber(represadas)} represadas` : 'al día'}
                    </span>
                    <ChevronRight className="fila-contratista-flecha" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {actual ? <DetalleContrato contrato={actual} /> : null}
      </div>
    </Modal>
  );
}
