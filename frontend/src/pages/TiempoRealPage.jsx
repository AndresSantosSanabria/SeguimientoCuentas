import { Activity, Pause, Play, Radio, RefreshCw, Search, Trash2, Wifi, WifiOff, } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCdc } from '@/hooks/useCdc';
import { estadoColor } from '@/lib/estados';
import { formatDateTime, formatNumber, formatPercent, formatRelativeTime, } from '@/lib/format';
function rowsFromEstado(estado) {
    const rows = [];
    const push = (label, value) => {
        if (value === undefined || value === null || value === '')
            return;
        rows.push({ label, value });
    };
    push('Estado', estado.estado);
    push('Id estado', estado.id_estado);
    push('Detalle', estado.detalle_estado);
    push('Fecha del estado', estado.fecha_estado ? formatDateTime(estado.fecha_estado) : undefined);
    push('Paso anterior', estado.paso_anterior);
    push('Avance declarado', typeof estado.porcentaje_avance === 'number'
        ? formatPercent(estado.porcentaje_avance, 0)
        : undefined);
    push('Avance general', typeof estado.avance_general_contrato === 'number'
        ? formatPercent(estado.avance_general_contrato, 0)
        : undefined);
    push('Siguiente paso', estado.siguiente_paso);
    push('Cuenta actual', typeof estado.cuenta_cobro_actual === 'number'
        ? formatNumber(estado.cuenta_cobro_actual)
        : undefined);
    push('Última supervisión', typeof estado.ultima_supervision === 'number'
        ? formatNumber(estado.ultima_supervision)
        : undefined);
    push('Cuentas aprobadas', typeof estado.cuentas_aprobadas === 'number' && typeof estado.total_cuentas_cobro === 'number'
        ? `${estado.cuentas_aprobadas} de ${estado.total_cuentas_cobro}`
        : undefined);
    push('Devolución', typeof estado.es_devolucion === 'boolean' ? (estado.es_devolucion ? 'Sí' : 'No') : undefined);
    push('Rechazo', typeof estado.es_rechazo === 'boolean' ? (estado.es_rechazo ? 'Sí' : 'No') : undefined);
    push('En firme', typeof estado.en_firme === 'boolean' ? (estado.en_firme ? 'Sí' : 'No') : undefined);
    return rows;
}
const ETIQUETAS_ESTATUS = {
    connected: {
        label: 'Conectado al flujo CDC',
        description: 'Los cambios de PostgreSQL se están recibiendo en tiempo real.',
        icon: Wifi,
        tone: 'success',
    },
    connecting: {
        label: 'Conectando al flujo CDC',
        description: 'Estableciendo la conexión WebSocket con el backend.',
        icon: Radio,
        tone: 'warning',
    },
    disconnected: {
        label: 'Sin conexión con el flujo CDC',
        description: 'Se reintentará automáticamente. También puedes reconectar ahora.',
        icon: WifiOff,
        tone: 'danger',
    },
};
export function TiempoRealPage() {
    const { status, url, events, lastEvent, paused, setPaused, clearEvents, reconnect } = useCdc();
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState('');
    const filteredEvents = useMemo(() => {
        const term = query.trim().toUpperCase();
        if (!term)
            return events;
        return events.filter((event) => event.contrato.toUpperCase().includes(term));
    }, [events, query]);
    const detail = selected ?? lastEvent ?? filteredEvents[0] ?? null;
    const uniqueContracts = useMemo(() => new Set(events.map((event) => event.contrato)).size, [events]);
    const statusInfo = ETIQUETAS_ESTATUS[status];
    const StatusIcon = statusInfo.icon;
    const cuentas = detail?.estado.cuentas_cobro ?? [];
    const detailRows = detail ? rowsFromEstado(detail.estado) : [];
    return (<div className="pila-pagina">
      <PageHeader eyebrow="Captura de cambios" title="Tiempo real" description="Eventos enviados por Debezium a través de /ws/cdc cuando cambian las tablas de contratos, supervisión e informes." actions={<>
            <button type="button" className="btn btn-ghost" onClick={() => setPaused(!paused)} disabled={status !== 'connected'}>
              {paused ? <Play/> : <Pause/>}
              {paused ? 'Reanudar feed' : 'Pausar feed'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearEvents} disabled={events.length === 0}>
              <Trash2/>
              Limpiar
            </button>
            <button type="button" className="btn btn-primary" onClick={reconnect}>
              <RefreshCw/>
              Reconectar
            </button>
          </>}/>

      <Card tone={statusInfo.tone} className="card-tono">
        <div className="banner-cuerpo">
          <span data-tone={statusInfo.tone} className="icono-globo icono-globo-banner">
            <StatusIcon className={status === 'connecting' ? 'parpadeo' : undefined}/>
          </span>
          <div className="banner-texto">
            <p className="banner-titulo">{statusInfo.label}</p>
            <p className="banner-detalle">{statusInfo.description}</p>
          </div>
          <div className="banner-stats">
            <div>
              <p className="micro-label">
                Eventos
              </p>
              <p className="banner-dato-valor">{formatNumber(events.length)}</p>
            </div>
            <div>
              <p className="micro-label">
                Contratos
              </p>
              <p className="banner-dato-valor">{formatNumber(uniqueContracts)}</p>
            </div>
            <div>
              <p className="micro-label">
                Último evento
              </p>
              <p className="banner-dato-texto">
                {lastEvent ? formatRelativeTime(lastEvent.timestamp) : '—'}
              </p>
            </div>
            <Badge tone={statusInfo.tone} dot>
              {paused ? 'Feed en pausa' : status === 'connected' ? 'Escuchando' : status}
            </Badge>
          </div>
        </div>
        <div className="banner-pie">
          <code className="banner-pie-codigo">{url}</code>
        </div>
      </Card>

      <div className="cuadricula-panel">
        <Card className="tarjeta-columna celda-col-media">
          <CardHeader title="Eventos recibidos" subtitle="Se conservan los últimos 150 eventos de la sesión." action={<Badge tone="info">{formatNumber(filteredEvents.length)}</Badge>}/>
          <div className="busqueda-barra">
            <label className="busqueda-campo">
              <Search className="input-icono"/>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="input input-corto input-con-icono input-xs" placeholder="Filtrar por número de contrato…"/>
            </label>
          </div>

          {filteredEvents.length === 0 ? (<EmptyState icon={Activity} title={events.length === 0 ? 'Esperando eventos' : 'Sin coincidencias'} description={events.length === 0
                ? 'Cuando cambie una tabla monitoreada, el evento aparecerá aquí automáticamente.'
                : 'Prueba con otro número de contrato.'}/>) : (<ul className="lista-eventos">
              {filteredEvents.map((event, index) => {
                const isSelected = detail === event;
                return (<li key={`${event.contrato}-${event.timestamp}-${index}`}>
                    <button type="button" onClick={() => setSelected(event)} aria-pressed={isSelected} className="evento-boton">
                      <div className="evento-linea">
                        <span className="evento-punto" style={{ backgroundColor: estadoColor(event.estado.id_estado) }}/>
                        <span className="evento-contrato">
                          {event.contrato}
                        </span>
                        <span className="evento-tiempo">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                      <div className="evento-etiquetas">
                        <Badge tone="info">{event.tipo}</Badge>
                        <Badge tone="neutral">{event.tabla}</Badge>
                        <span className="evento-nombre">
                          {event.estado.estado ?? 'Estado sin nombre'}
                        </span>
                      </div>
                    </button>
                  </li>);
                })}
            </ul>)}

          {paused ? (<div className="aviso-pausa">
              El feed está en pausa; los nuevos eventos no se agregan a la lista.
            </div>) : null}
        </Card>

        <Card className="celda-col-larga">
          <CardHeader title="Detalle del evento" subtitle="Estado consolidado del contrato al momento del cambio."/>

          {!detail ? (<EmptyState icon={Radio} title="Sin evento seleccionado" description="Selecciona un evento de la lista o espera a que Debezium transmita un cambio."/>) : (<div className="card-body evento-cuerpo">
              <div className="detalle-evento">
                <div className="ajuste-minimo">
                  <p className="detalle-evento-contrato">{detail.contrato}</p>
                  <p className="detalle-evento-meta">
                    {detail.tipo} · tabla {detail.tabla} · {formatDateTime(detail.timestamp)}
                  </p>
                </div>
                <div className="detalle-evento-marca">
                  <EstadoBadge id={detail.estado.id_estado} label={detail.estado.estado}/>
                  {detail.estado.es_rechazo ? <Badge tone="danger">Rechazo</Badge> : null}
                  {detail.estado.es_devolucion ? <Badge tone="warning">Devolución</Badge> : null}
                </div>
              </div>

              <dl className="datos-dos-columnas">
                {detailRows.map((row) => (<div key={row.label} className="info-bloque info-bloque-plain">
                    <dt className="micro-label">
                      {row.label}
                    </dt>
                    <dd className="info-bloque-valor texto-roto">
                      {row.value}
                    </dd>
                  </div>))}
              </dl>

              {cuentas.length > 0 ? (<div>
                  <p className="micro-label micro-label-encabezado">
                    Cuentas de cobro del contrato
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
                            <td className="table-td table-td-compacta table-td-min">{cuenta.id_informe_actividad}</td>
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
        </Card>
      </div>
    </div>);
}
