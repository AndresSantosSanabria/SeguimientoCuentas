import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight, Download, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { Modal } from '@/components/ui/Modal';
import { dependenciaLabel } from '@/lib/dependencias';
import { cuentasAlDia, cuentasRepresadas } from '@/lib/supervisores';
import { cuentasSupervisor, descargarSupervisorDetalleExcel } from '@/lib/supervisoresExcel';
import { formatDate, formatNumber, normalizar } from '@/lib/format';

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
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);
  const hoy = useMemo(() => new Date(), []);
  const filasCuentas = useMemo(() => cuentasSupervisor(supervisor, hoy), [supervisor, hoy]);
  useEffect(() => setSeleccionado(0), [supervisor?.label]);
  const contratosFiltrados = useMemo(() => {
    const termino = normalizar(busqueda);
    return contratos.map((contrato, index) => ({ contrato, index })).filter(({ contrato }) =>
      !termino || normalizar(`${contrato.noContrato} ${contrato.contratista} ${dependenciaLabel(contrato)}`).includes(termino));
  }, [contratos, busqueda]);
  const actual = contratos[Math.min(seleccionado, Math.max(0, contratos.length - 1))];
  useEffect(() => setSeleccionado(contratosFiltrados[0]?.index ?? -1), [contratosFiltrados]);

  async function descargar() {
    if (exportando || contratos.length === 0) return;
    setExportando(true);
    try {
      await descargarSupervisorDetalleExcel(supervisor, new Date());
    } finally {
      setExportando(false);
    }
  }

  return (
    <Modal
      title={supervisor?.label ?? ''}
      subtitle={`${formatNumber(supervisor?.value ?? 0)} contratos · ${formatNumber(supervisor?.alDia ?? 0)} cuentas a tiempo · ${formatNumber(supervisor?.represadas ?? 0)} represadas`}
      onClose={onClose}
      className="modal-panel-ancha"
      action={
        <button
          type="button"
          className="btn btn-inverso"
          onClick={descargar}
          disabled={exportando || contratos.length === 0}
          title="Excel con dos hojas: sus contratos asignados y una fila por cada cuota exigible a hoy (radicada o pendiente). No depende del rango de fechas de Analítica."
        >
          <Download />
          {exportando ? 'Generando…' : 'Descargar Excel'}
          <span className="btn-contador">{formatNumber(filasCuentas.length)}</span>
        </button>
      }
    >
      <div className="modal-supervisor">
        <div>
          <p className="micro-label micro-label-encabezado">Contratos asignados · {formatNumber(contratosFiltrados.length)} de {formatNumber(contratos.length)}</p>
          <label className="buscador-supervisor">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar contrato, contratista o secretaría"
              aria-label="Buscar contratos asignados"
            />
          </label>
          <ul className="modal-supervisor-lista">
            {contratosFiltrados.map(({ contrato, index }) => {
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
                      <span className="fila-contratista-nombre">{contrato.noContrato}</span>
                      <span className="fila-contratista-dep">
                        {contrato.contratista} · {dependenciaLabel(contrato)}
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
            {contratosFiltrados.length === 0 ? <li className="modal-supervisor-vacio">No hay contratos que coincidan con la búsqueda.</li> : null}
          </ul>
        </div>

        {actual ? <DetalleContrato contrato={actual} /> : null}
      </div>
    </Modal>
  );
}
