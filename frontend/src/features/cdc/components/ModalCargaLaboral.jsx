import { Download, Inbox, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '@/shared/components/ui';
import { nombreBloque, buildCargaLaboral } from '@/features/cdc/utils/cargaLaboral';
import { descargarCargaLaboralExcel } from '@/features/cdc/utils/cargaLaboralExcel';
import { formatDateTime, formatNumber } from '@/shared/utils';

const ALCANCES = [
  { valor: 'todas', label: 'Todas las cuentas' },
  { valor: 'curso', label: 'Solo en curso' },
  { valor: 'cerradas', label: 'Solo cerradas / pagadas' },
];

const FILAS_VISTA = 60;

function Kpi({ label, value }) {
  return (
    <div className="carga-kpi">
      <span className="carga-kpi-valor">{value}</span>
      <span className="carga-kpi-label">{label}</span>
    </div>
  );
}

export function ModalCargaLaboral({ contratos, usuario, claves = [], onClose }) {
  const hoy = useMemo(() => new Date(), []);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [alcance, setAlcance] = useState('todas');
  const [texto, setTexto] = useState('');
  const [incluirEnManos, setIncluirEnManos] = useState(true);
  const [exportando, setExportando] = useState(false);

  const carga = useMemo(
    () => buildCargaLaboral(contratos, claves, { desde, hasta, alcance, texto, incluirEnManos }, hoy),
    [contratos, claves, desde, hasta, alcance, texto, incluirEnManos, hoy],
  );

  async function descargar() {
    if (exportando || carga.movimientos.length === 0) return;
    setExportando(true);
    try {
      await descargarCargaLaboralExcel(carga, hoy);
    } finally {
      setExportando(false);
    }
  }

  const visibles = carga.movimientos.slice(0, FILAS_VISTA);

  return (
    <Modal
      title="Carga laboral"
      subtitle={`Evidencia de lo gestionado por ${usuario || 'el usuario conectado'}: qué cuentas tuvo en sus manos, cuánto tiempo y a quién las entregó.`}
      onClose={onClose}
      className="modal-panel-ancha"
      action={
        <button
          type="button"
          className="btn btn-excel"
          onClick={descargar}
          disabled={exportando || carga.movimientos.length === 0}
          title="Excel con dos hojas: un renglón por estadía (recibido de → entregado a, con fechas y días) y un resumen por cuenta."
        >
          <Download />
          {exportando ? 'Generando…' : 'Descargar Excel'}
          <span className="btn-contador">{formatNumber(carga.movimientos.length)}</span>
        </button>
      }
    >
      <div className="carga-modal">
        <div className="carga-filtros">
          <label className="carga-campo">
            <span className="micro-label">Recibidas desde</span>
            <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="carga-campo">
            <span className="micro-label">Recibidas hasta</span>
            <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <label className="carga-campo">
            <span className="micro-label">Alcance</span>
            <select className="input" value={alcance} onChange={(e) => setAlcance(e.target.value)}>
              {ALCANCES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>{opcion.label}</option>
              ))}
            </select>
          </label>
          <label className="carga-campo carga-campo-busqueda">
            <span className="micro-label">Buscar</span>
            <span className="carga-busqueda">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Contrato o contratista…"
                aria-label="Buscar contrato o contratista"
              />
            </span>
          </label>
          <label className="carga-check">
            <input
              type="checkbox"
              checked={incluirEnManos}
              onChange={(e) => setIncluirEnManos(e.target.checked)}
            />
            <span>Incluir las que aún tengo en mis manos</span>
          </label>
        </div>

        <div className="carga-kpis">
          <Kpi label="Movimientos" value={formatNumber(carga.totales.movimientos)} />
          <Kpi label="Cuentas gestionadas" value={formatNumber(carga.totales.cuentas)} />
          <Kpi label="Días en mis manos" value={formatNumber(carga.totales.dias)} />
          <Kpi label="Aún conmigo" value={formatNumber(carga.totales.enManos)} />
        </div>

        {visibles.length > 0 ? (
          <div className="carga-tabla">
            <table className="tabla-interna">
              <thead>
                <tr>
                  <th className="table-th table-th-compacta">Contrato</th>
                  <th className="table-th table-th-compacta">Cuenta</th>
                  <th className="table-th table-th-compacta">Bloque</th>
                  <th className="table-th table-th-compacta">Recibido de</th>
                  <th className="table-th table-th-compacta">Recibido el</th>
                  <th className="table-th table-th-compacta">Entregado a</th>
                  <th className="table-th table-th-compacta">Días</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((tramo, index) => (
                  <tr key={`${tramo.contrato}-${tramo.idInformeActividad}-${index}`}>
                    <td className="table-td table-td-compacta">{tramo.contrato}</td>
                    <td className="table-td table-td-compacta">{tramo.cuenta}</td>
                    <td className="table-td table-td-compacta texto-apoyo">{nombreBloque(tramo.bloque)}</td>
                    <td className="table-td table-td-compacta">{tramo.recibidoDe}</td>
                    <td className="table-td table-td-compacta texto-apoyo">{formatDateTime(tramo.recibidoEl)}</td>
                    <td className="table-td table-td-compacta">
                      {tramo.enManos ? '— en mis manos —' : tramo.entregadoA}
                    </td>
                    <td className="table-td table-td-compacta">{formatNumber(Math.round(tramo.dias * 100) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {carga.movimientos.length > visibles.length ? (
              <p className="texto-apoyo carga-nota">
                Mostrando {formatNumber(visibles.length)} de {formatNumber(carga.movimientos.length)} movimientos.
                El Excel incluye todos.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="carga-vacio">
            <Inbox />
            <p>
              No hay movimientos que coincidan con estos filtros para {usuario || 'el usuario conectado'}.
              Prueba ampliando el rango de fechas o el alcance.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
