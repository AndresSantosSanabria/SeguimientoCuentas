import { FileSearch, Inbox, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { etiquetaCuenta, nombreEstado, rolDeEstado } from '@/lib/bloques';
import { formatDateTime } from '@/lib/format';

function TarjetaCuenta({ item, vivo, seleccionada, onSelect }) {
  const { contrato, cuenta, clase } = item;
  const devolucion = clase.modo === 'devolucion';
  const origen = rolDeEstado(clase.origen);
  return (
    <li>
      <button
        type="button"
        aria-pressed={seleccionada}
        onClick={() => onSelect(item)}
        className="cuenta-tarjeta"
        data-modo={clase.modo}
      >
        <span className="cuenta-tarjeta-cima">
          <span className="cuenta-tarjeta-id">{etiquetaCuenta(cuenta)}</span>
          {devolucion ? (
            <Badge tone="warning">Devolución</Badge>
          ) : (
            <EstadoBadge id={cuenta.idEstadoActual} label={cuenta.estadoActual} />
          )}
        </span>

        <span className="cuenta-tarjeta-contrato">
          Contrato {contrato?.noContrato ?? '—'}
        </span>
        <span className="cuenta-tarjeta-contratista">{contrato?.contratista ?? 'Contratista no disponible'}</span>

        {devolucion ? (
          <span className="cuenta-tarjeta-detalle">
            <span className="cuenta-tarjeta-detalle-linea">
              Devuelto por: <strong>{origen ?? 'sin registro'}</strong>
            </span>
            {cuenta.descripcionEstado?.trim() ? (
              <span className="cuenta-tarjeta-motivo">{cuenta.descripcionEstado}</span>
            ) : null}
            <span className="cuenta-tarjeta-detalle-linea">
              {cuenta.fechaEstado
                ? `En devolución desde ${formatDateTime(cuenta.fechaEstado)}`
                : 'Sin fecha de devolución'}
              {cuenta.siguientePaso?.trim() ? ` · ${cuenta.siguientePaso}` : ''}
            </span>
          </span>
        ) : (
          <span className="cuenta-tarjeta-detalle">
            <span className="cuenta-tarjeta-detalle-linea">
              <strong>{nombreEstado(cuenta)}</strong>
              {contrato?.supervisor ? ` · Supervisor: ${contrato.supervisor}` : ''}
            </span>
            {cuenta.descripcionEstado?.trim() ? (
              <span className="cuenta-tarjeta-motivo">{cuenta.descripcionEstado}</span>
            ) : null}
            <span className="cuenta-tarjeta-detalle-linea">
              {cuenta.fechaEstado
                ? `En este bloque desde ${formatDateTime(cuenta.fechaEstado)}`
                : 'Sin fecha de estado'}
            </span>
          </span>
        )}

        <span className="cuenta-tarjeta-pie">
          <span data-vivo={vivo ? 'si' : 'no'} className="cuenta-tarjeta-cdc">
            {vivo ? 'Movimiento CDC reciente' : 'CDC sincronizado'}
          </span>
          <span className="cuenta-tarjeta-avance">Ver trazabilidad →</span>
        </span>
      </button>
    </li>
  );
}

function ColumnaCuentas({ titulo, hint, items, modo, vivos, seleccion, onSelect }) {
  return (
    <div className="lista-cuentas" data-modo={modo}>
      <header className="lista-cuentas-cabecera">
        <h3 className="lista-cuentas-titulo">{titulo}</h3>
        <span data-modo={modo} className="lista-cuentas-conteo">
          {items.length} {hint}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="lista-cuentas-vacia">
          <Inbox />
          <p>Sin cuentas en este estado dentro del bloque.</p>
        </div>
      ) : (
        <ul className="lista-cuentas-items">
          {items.map((item) => (
            <TarjetaCuenta
              key={`${item.contrato?.noContrato}-${item.cuenta.idInformeActividad}`}
              item={item}
              vivo={vivos.has(item.contrato?.noContrato)}
              seleccionada={
                seleccion?.cuenta === item.cuenta.idInformeActividad &&
                seleccion?.contrato === item.contrato?.noContrato
              }
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * El bloque elegido: sus cuentas en curso y sus cuentas en devolución, con
 * buscador para llegar rápido a un contrato o a una cuenta concreta.
 */
export function PanelBloque({ bloque, listas, consulta, onConsulta, seleccion, onSelect, vivos }) {
  const total = listas.curso.length + listas.devolucion.length;
  return (
    <Card className="tarjeta-columna celda-col-grande">
      <CardHeader
        title={`Bloque Seleccionado: ${bloque.nombre}`}
        subtitle={`${total} cuentas activas radicadas actualmente en este bloque (${listas.curso.length} en trámite regular, ${listas.devolucion.length} con observaciones).`}
        action={
          <span className="bloque-tarjeta-numero bloque-tarjeta-numero-grande">
            #{bloque.numero}
          </span>
        }
      />

      <div className="panel-bloque-barra">
        <label className="busqueda-campo">
          <Search className="input-icono" />
          <input
            value={consulta}
            onChange={(evento) => onConsulta(evento.target.value)}
            className="input input-corto input-con-icono input-xs"
            placeholder="Filtrar por contrato, contratista o cuenta…"
          />
        </label>
        <div className="panel-bloque-chips">
          <span className="chip-conteo" data-modo="todas">
            Todas ({total})
          </span>
          <span className="chip-conteo" data-modo="curso">
            En curso ({listas.curso.length})
          </span>
          <span className="chip-conteo" data-modo="devolucion">
            Devolución ({listas.devolucion.length})
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="lista-cuentas-vacia lista-cuentas-vacia-amplia">
          <FileSearch />
          <p>
            Este bloque no tiene cuentas en trámite: no hay cuentas radicadas ni devueltas que
            esperen aquí.
          </p>
        </div>
      ) : (
        <div className="panel-bloque-listas">
          <ColumnaCuentas
            titulo="Cuentas En Curso"
            hint="Activas"
            modo="curso"
            items={listas.curso}
            vivos={vivos}
            seleccion={seleccion}
            onSelect={onSelect}
          />
          <ColumnaCuentas
            titulo="Cuentas en Devolución"
            hint="Con observaciones"
            modo="devolucion"
            items={listas.devolucion}
            vivos={vivos}
            seleccion={seleccion}
            onSelect={onSelect}
          />
        </div>
      )}
    </Card>
  );
}
