import { User } from 'lucide-react';
import { useMemo } from 'react';
import { rolDeEstado } from '@/features/cuentas/utils/bloques';
import { ESTADO_APROBADO, ESTADOS_RECHAZO, ESTADO_DEVOLUCION, estadoColor, estadoLabel } from '@/features/cuentas/utils/estados';
import { parseDateOnly } from '@/shared/utils';

const DIA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });

function fechaDe(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? parseDateOnly(texto) : new Date(texto);
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}

function tonoDe(idEstado) {
  if (idEstado === ESTADO_APROBADO) return 'cerrado';
  if (ESTADOS_RECHAZO.has(idEstado) || idEstado === ESTADO_DEVOLUCION) return 'devuelta';
  return 'curso';
}

/** Los estados que no son de un rol del flujo se atribuyen a quien los produce. */
const ORIGEN_EXTRA = {
  0: 'Contratista',
  3: 'Supervisor',
  8: 'SECOP II',
  10: 'Supervisor',
  19: 'SECOP II',
};

export function FlujoCuentaLineaTiempo({ pasos = [], cuenta }) {
  const eventos = useMemo(() => {
    const lista = (Array.isArray(pasos) ? pasos : []).filter(
      (paso) => paso && typeof paso.idEstado === 'number',
    );
    return [...lista].sort((a, b) => {
      const fa = fechaDe(a.fecha)?.getTime() ?? 0;
      const fb = fechaDe(b.fecha)?.getTime() ?? 0;
      return fb - fa;
    });
  }, [pasos]);

  if (eventos.length === 0) return null;

  return (
    <ol className="flujo-tiempo">
      {eventos.map((paso, indice) => {
        const fecha = fechaDe(paso.fecha);
        const titulo = estadoLabel(paso.idEstado, paso.estado);
        const rol = rolDeEstado(paso.idEstado) ?? ORIGEN_EXTRA[paso.idEstado] ?? null;
        const origen = paso.descripcion?.trim() || rol || '—';
        const actual = indice === 0 && cuenta?.idEstadoActual === paso.idEstado;
        const cerrado = paso.idEstado === ESTADO_APROBADO;
        return (
          <li
            key={`${paso.idEstado}-${paso.fecha ?? indice}`}
            className="flujo-tiempo-item"
            data-tono={tonoDe(paso.idEstado)}
            data-actual={actual ? 'true' : undefined}
          >
            <div className="flujo-tiempo-when">
              <span className="flujo-tiempo-dia">{fecha ? DIA.format(fecha) : '—'}</span>
              <span className="flujo-tiempo-hora">{fecha ? HORA.format(fecha) : ''}</span>
            </div>

            <span
              className="flujo-tiempo-punto"
              style={{ '--punto': estadoColor(paso.idEstado) }}
              aria-hidden="true"
            />

            <div className="flujo-tiempo-card">
              <p className="flujo-tiempo-titulo">
                {titulo}
                {actual ? <span className="flujo-tiempo-hoy">Estado actual</span> : null}
                {cerrado ? <span className="flujo-tiempo-hoy">Cerrada</span> : null}
              </p>
              <p className="flujo-tiempo-origen">Origen: {origen}</p>
              <p className="flujo-tiempo-actor">
                <User size={12} aria-hidden="true" />
                {paso.usuario?.trim() || rol || 'Sin responsable registrado'}
                {paso.rolUsuario?.trim() ? ` · ${paso.rolUsuario}` : ''}
              </p>
              {paso.destinatario?.trim() ? (
                <p className="flujo-tiempo-actor">
                  <User size={12} aria-hidden="true" />
                  Enviado a {paso.destinatario}
                  {paso.rolDestinatario?.trim() ? ` · ${paso.rolDestinatario}` : ''}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
