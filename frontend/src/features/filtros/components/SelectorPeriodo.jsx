import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES } from '@/features/cuentas';

const DIAS_SEMANA = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function iso(date) {
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

function fechaDe(isoTexto) {
  if (!isoTexto) return null;
  const [anio, mes, dia] = isoTexto.split('-').map(Number);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;
  return new Date(anio, mes - 1, dia);
}

function etiquetaCorta(isoTexto) {
  const fecha = fechaDe(isoTexto);
  return fecha
    ? `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`
    : '';
}

/**
 * Selector de período: un calendario de verdad (mes y año arriba, rejilla de días abajo)
 * para acotar el análisis a un rango de fechas. El primer clic pone el inicio y el
 * segundo el final; con «Limpiar» vuelve a medir todo el histórico.
 */
export function SelectorPeriodo({ desde, hasta, onChange, anios = [], etiqueta = 'Período' }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const hoy = useMemo(() => new Date(), []);
  const [mesVista, setMesVista] = useState(hoy.getMonth());
  const [anioVista, setAnioVista] = useState(hoy.getFullYear());

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAbierto(false);
    };
    const tecla = (evento) => { if (evento.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const dias = useMemo(() => {
    const primero = new Date(anioVista, mesVista, 1);
    const inicio = new Date(anioVista, mesVista, 1 - primero.getDay());
    return Array.from({ length: 42 }, (_, indice) =>
      new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice));
  }, [anioVista, mesVista]);

  const inicioRango = fechaDe(desde);
  const finRango = fechaDe(hasta);

  const elegirDia = (fecha) => {
    const valor = iso(fecha);
    if (!desde || (desde && hasta)) {
      onChange({ desde: valor, hasta: '' });
      return;
    }
    const inicio = fechaDe(desde);
    if (inicio && fecha.getTime() < inicio.getTime()) {
      onChange({ desde: valor, hasta: desde });
      return;
    }
    onChange({ desde, hasta: valor });
  };

  const moverMes = (delta) => {
    const fecha = new Date(anioVista, mesVista + delta, 1);
    setAnioVista(fecha.getFullYear());
    setMesVista(fecha.getMonth());
  };

  const elegirMes = (mes) => {
    const fecha = new Date(anioVista, mes, 1);
    setAnioVista(fecha.getFullYear());
    setMesVista(fecha.getMonth());
  };

  const elegirAnio = (anio) => {
    setAnioVista(Number(anio));
  };

  const mesesDelRango = (mes, anio) => {
    const primero = new Date(anio, mes, 1);
    const ultimo = new Date(anio, mes + 1, 0);
    onChange({ desde: iso(primero), hasta: iso(ultimo) });
  };

  const anioCompleto = (anio) => {
    onChange({ desde: iso(new Date(anio, 0, 1)), hasta: iso(new Date(anio, 11, 31)) });
  };

  const texto = !desde
    ? 'Todo el histórico'
    : !hasta
      ? `Desde el ${etiquetaCorta(desde)}`
      : desde === hasta
        ? etiquetaCorta(desde)
        : `${etiquetaCorta(desde)} → ${etiquetaCorta(hasta)}`;

  // La lista de años se acota a una ventana razonable: el histórico trae años
  // mal capturados (hasta 1900) que solo ensucian el desplegable.
  const aniosDisponibles = useMemo(() => {
    const lista = anios.length > 0 ? anios : [hoy.getFullYear()];
    const maximo = Math.max(hoy.getFullYear(), ...lista);
    const minimo = maximo - 25;
    return [...new Set([...lista, anioVista])]
      .filter((anio) => anio >= minimo && anio <= maximo + 2)
      .sort((a, b) => b - a);
  }, [anios, anioVista, hoy]);

  return (
    <div className="selector selector-periodo" ref={raiz}>
      <span className="field-label-corto">{etiqueta}</span>
      <button
        type="button"
        className="selector-boton input input-corto"
        onClick={() => setAbierto((previo) => !previo)}
        aria-expanded={abierto}
        title={texto}
      >
        <CalendarDays />
        <span className="selector-boton-texto">{texto}</span>
        <ChevronDown className="selector-boton-flecha" />
      </button>
      {abierto ? (
        <div className="periodo-panel">
          <div className="periodo-cabecera">
            <button type="button" className="periodo-flecha" onClick={() => moverMes(-1)} aria-label="Mes anterior">
              <ChevronLeft size={15} />
            </button>
            <select className="input input-corto periodo-mes" value={mesVista} onChange={(event) => elegirMes(Number(event.target.value))} aria-label="Mes">
              {MESES.map((nombre, indice) => (<option key={nombre} value={indice}>
                  {nombre}
                </option>))}
            </select>
            <select className="input input-corto periodo-anio" value={anioVista} onChange={(event) => elegirAnio(event.target.value)} aria-label="Año">
              {aniosDisponibles.map((anio) => (<option key={anio} value={anio}>
                  {anio}
                </option>))}
            </select>
            <button type="button" className="periodo-flecha" onClick={() => moverMes(1)} aria-label="Mes siguiente">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="periodo-rejilla" role="grid">
            {DIAS_SEMANA.map((dia) => (<span key={dia} className="periodo-dia-semana" role="columnheader">
                {dia}
              </span>))}
            {dias.map((fecha) => {
              const valor = iso(fecha);
              const otroMes = fecha.getMonth() !== mesVista;
              const esInicio = desde === valor;
              const esFin = hasta === valor;
              const enRango = Boolean(inicioRango && finRango
                && fecha.getTime() >= inicioRango.getTime() && fecha.getTime() <= finRango.getTime());
              return (
                <button
                  key={valor}
                  type="button"
                  role="gridcell"
                  className="periodo-dia"
                  data-fuera={otroMes ? 'true' : undefined}
                  data-inicio={esInicio ? 'true' : undefined}
                  data-fin={esFin ? 'true' : undefined}
                  data-rango={enRango ? 'true' : undefined}
                  onClick={() => elegirDia(fecha)}
                  aria-label={etiquetaCorta(valor)}
                >
                  {fecha.getDate()}
                </button>
              );
            })}
          </div>

          <div className="periodo-acciones">
            <button type="button" className="selector-accion" onClick={() => mesesDelRango(hoy.getMonth(), hoy.getFullYear())}>Este mes</button>
            <button type="button" className="selector-accion" onClick={() => mesesDelRango((hoy.getMonth() + 11) % 12, hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear())}>Mes anterior</button>
            <button type="button" className="selector-accion" onClick={() => anioCompleto(anioVista)}>Año {anioVista}</button>
            <button type="button" className="selector-accion" onClick={() => onChange({ desde: '', hasta: '' })} disabled={!desde && !hasta}>Limpiar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
