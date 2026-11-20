import { ChevronDown, ChevronRight, Download, FilterX, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/shared/components/ui';
import { Desplegable } from '@/shared/components/ui';
import { ErrorState } from '@/shared/components/ui';
import { EstadoBadge } from '@/features/cuentas';
import { PageHeader } from '@/shared/components/ui';
import { Pagination } from '@/shared/components/ui';
import { ProgressBar } from '@/shared/components/ui';
import { SelectorAnios } from '@/features/filtros';
import { TableSkeleton } from '@/shared/components/ui';
import { useAuth } from '@/features/sesion/components/AuthProvider';
import { useContratos } from '@/features/contratos';
import { ALCANCES_CUENTAS, contratosEnAlcance } from '@/features/cuentas';
import { ALERTA_OPTIONS, AVANCE_OPTIONS, INFORME_OPTIONS, ORDEN_OPTIONS, SUPERVISION_OPTIONS, compareContratos, isAlertaFiltro, isAvanceFiltro, isInformeFiltro, isOrdenFiltro, isSupervisionFiltro, matchesAlerta, matchesAvance, matchesInforme, matchesSupervision, } from '@/features/contratos';
import { aniosDisponibles, contratoEnAnios } from '@/features/cuentas';
import { downloadCsv } from '@/shared/utils';
import { estadoLabel } from '@/features/cuentas';
import { formatDate, formatNumber, normalizar, truncate } from '@/shared/utils';
const PAGE_SIZE = 20;
/** Valor interno para el contrato que todavía no tiene supervisor asignado. */
const SIN_SUPERVISOR = '__sin_supervisor__';

/** Filtro en forma de pilla: la etiqueta y el valor viven en la misma pastilla. */
function PillaFiltro({ etiqueta, valor, opciones, onChange, activa }) {
    return (
      <Desplegable
        etiqueta={etiqueta}
        valor={valor}
        opciones={opciones}
        onChange={onChange}
        activa={activa}
      />
    );
}

export function ContratosPage() {
    const { data, isLoading, isError, refetch } = useContratos();
    const { puede, rol } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const qParam = searchParams.get('q') ?? '';
    const estadoParam = searchParams.get('estado') ?? 'all';
    const avanceParam = searchParams.get('avance');
    const alertaParam = searchParams.get('alerta');
    const supervisionParam = searchParams.get('supervision');
    const informeParam = searchParams.get('informe');
    const ordenParam = searchParams.get('orden');
    const aniosParam = searchParams.get('anios');
    const alcanceParam = searchParams.get('alcance');
    const supervisorParam = searchParams.get('supervisor') ?? 'all';
    const pageParam = Number(searchParams.get('page') ?? '1');
    const avance = isAvanceFiltro(avanceParam) ? avanceParam : 'all';
    const alerta = isAlertaFiltro(alertaParam) ? alertaParam : 'all';
    const supervision = isSupervisionFiltro(supervisionParam) ? supervisionParam : 'all';
    const informe = isInformeFiltro(informeParam) ? informeParam : 'all';
    const orden = isOrdenFiltro(ordenParam) ? ordenParam : 'fecha-desc';
    // Años y alcance de cuentas: el mismo universo que mide la analítica, para que
    // los KPI y el listado cuenten exactamente los mismos contratos.
    const anios = useMemo(() => (aniosParam ? aniosParam.split(',').map(Number).filter((valor) => Number.isFinite(valor)).sort((a, b) => b - a) : []), [aniosParam]);
    const alcance = ALCANCES_CUENTAS.some((option) => option.valor === alcanceParam) ? alcanceParam : 'todas';
    const [avanzadosAbiertos, setAvanzadosAbiertos] = useState(false);
    const updateParam = (key, value) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (!value || value === 'all' || value === 'todas')
                next.delete(key);
            else
                next.set(key, value);
            next.delete('page');
            return next;
        }, { replace: true });
    };
    const setAniosParam = (lista) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (!lista || lista.length === 0)
                next.delete('anios');
            else
                next.set('anios', lista.join(','));
            next.delete('page');
            return next;
        }, { replace: true });
    };
    const setPage = (page) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (page <= 1)
                next.delete('page');
            else
                next.set('page', String(page));
            return next;
        }, { replace: true });
    };
    const estados = useMemo(() => {
        if (!data)
            return [];
        const map = new Map();
        for (const contrato of data) {
            if (!map.has(contrato.idEstadoActual)) {
                map.set(contrato.idEstadoActual, estadoLabel(contrato.idEstadoActual, contrato.estadoActual));
            }
        }
        return [...map.entries()].sort((a, b) => a[0] - b[0]);
    }, [data]);
    const opcionesAnio = useMemo(() => (data ? aniosDisponibles(data) : []), [data]);
    const opcionesEstado = useMemo(() => [
        { value: 'all', label: 'Todos' },
        ...estados.map(([id, label]) => ({ value: String(id), label })),
    ], [estados]);
    const opcionesAlcance = useMemo(() => [
        { value: 'todas', label: 'Todas las cuentas' },
        ...ALCANCES_CUENTAS.map((option) => ({ value: option.valor, label: option.label })),
    ], []);
    const base = useMemo(() => {
        if (!data)
            return [];
        const porAnios = data.filter((contrato) => contratoEnAnios(contrato, anios));
        return alcance === 'todas' ? porAnios : contratosEnAlcance(porAnios, alcance);
    }, [data, anios, alcance]);
    // Supervisores presentes en el universo: el filtro ofrece solo los que de verdad
    // tienen contratos, para no ofrecer nombres que filtrarían a cero.
    const opcionesSupervisor = useMemo(() => {
        const nombres = new Set();
        let sinSupervisor = false;
        for (const contrato of base) {
            const nombre = contrato.supervisor?.trim();
            if (nombre)
                nombres.add(nombre);
            else
                sinSupervisor = true;
        }
        const lista = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
        return sinSupervisor ? [...lista, SIN_SUPERVISOR] : lista;
    }, [base]);
    const opcionesSupervisorDesplegable = useMemo(() => [
        { value: 'all', label: 'Todos' },
        ...opcionesSupervisor.map((nombre) => ({
            value: nombre,
            label: nombre === SIN_SUPERVISOR ? 'Sin supervisor asignado' : nombre,
        })),
    ], [opcionesSupervisor]);
    const filtered = useMemo(() => {
        if (!data)
            return [];
        const query = qParam.trim().toUpperCase();
        return base
            .filter((contrato) => {
            if (query) {
                const haystack = `${contrato.noContrato ?? ''} ${contrato.contratista ?? ''} ${contrato.supervisor ?? ''}`.toUpperCase();
                if (!haystack.includes(query))
                    return false;
            }
            if (estadoParam !== 'all' && String(contrato.idEstadoActual) !== estadoParam) {
                return false;
            }
            if (!matchesAvance(contrato, avance))
                return false;
            if (!matchesAlerta(contrato, alerta))
                return false;
            if (!matchesSupervision(contrato, supervision))
                return false;
            if (!matchesInforme(contrato, informe))
                return false;
            if (supervisorParam !== 'all') {
                const nombre = contrato.supervisor?.trim() ?? '';
                if (supervisorParam === SIN_SUPERVISOR) {
                    if (nombre)
                        return false;
                }
                else if (normalizar(nombre) !== normalizar(supervisorParam)) {
                    return false;
                }
            }
            return true;
        })
            .sort((a, b) => compareContratos(a, b, orden));
    }, [base, qParam, estadoParam, avance, alerta, supervision, informe, supervisorParam, orden]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, Number.isFinite(pageParam) ? pageParam : 1), totalPages);
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasFilters = Boolean(qParam) || estadoParam !== 'all' || avance !== 'all' || alerta !== 'all' || supervision !== 'all' || informe !== 'all' || supervisorParam !== 'all' || anios.length > 0 || alcance !== 'todas' || orden !== 'fecha-desc';
    const clearFilters = () => {
        setSearchParams({}, { replace: true });
    };
    const handleExport = () => {
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`contratos-${stamp}.csv`, [
            'No. contrato',
            'Contratista',
            'Supervisor',
            'Fecha inicio',
            'Fecha fin',
            'Supervisiones',
            'Supervisiones esperadas',
            'Cuentas registradas',
            'Cuentas esperadas',
            'Cuentas exigibles',
            'Cuentas en mora',
            'Avance %',
            'Estado',
            'Siguiente paso',
        ], filtered.map((contrato) => [
            contrato.noContrato,
            contrato.contratista,
            contrato.supervisor?.trim() || '—',
            contrato.fechaInicio,
            contrato.fechaFin,
            contrato.totalSupervisiones,
            contrato.totalSupervisionesEsperadas,
            contrato.cuentasRegistradas,
            contrato.cuentasEsperadas,
            contrato.cuentasExigibles,
            contrato.cuentasEnMora,
            contrato.porcentajeAvance,
            estadoLabel(contrato.idEstadoActual, contrato.estadoActual),
            contrato.siguientePaso,
        ]));
    };
    const cuerpo = isLoading ? (<div className="pila-pagina-amplia">
      <PageHeader eyebrow="Explorador" title="Contratos" description="Cargando el listado de contratos…"/>
      <TableSkeleton rows={10}/>
    </div>) : isError || !data ? (<div className="pila-pagina-amplia">
      <PageHeader eyebrow="Explorador" title="Contratos"/>
      <ErrorState onRetry={() => refetch()}/>
    </div>) : (<div className="pila-pagina">
      <PageHeader eyebrow="Explorador" title="Contratos" description={rol?.codigo === 'SUPERVISOR' ? 'Los contratos de tu supervisión. Abre uno para ver cómo va la cuenta de cobro seleccionada.' : 'Todos los contratos registrados, incluidos los ya cerrados. Filtra por estado, avance o alertas operativas.'} actions={puede('CONTRATOS_EXPORTAR') ? (<button type="button" className="btn btn-primary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download/>
            Exportar CSV
            <span className="btn-contador">
              {formatNumber(filtered.length)}
            </span>
          </button>) : null}/>

      <div className="filtros-pastillas">
        <div className="filtros-pastillas-fila">
          <PillaFiltro etiqueta="Estado" valor={estadoParam} opciones={opcionesEstado} onChange={(valor) => updateParam('estado', valor)} activa={estadoParam !== 'all'}/>

          <PillaFiltro etiqueta="Avance" valor={avance} opciones={AVANCE_OPTIONS} onChange={(valor) => updateParam('avance', valor)} activa={avance !== 'all'}/>

          <PillaFiltro etiqueta="Alertas" valor={alerta} opciones={ALERTA_OPTIONS} onChange={(valor) => updateParam('alerta', valor)} activa={alerta !== 'all'}/>

          <PillaFiltro etiqueta="Supervisión" valor={supervision} opciones={SUPERVISION_OPTIONS} onChange={(valor) => updateParam('supervision', valor)} activa={supervision !== 'all'}/>

          <button type="button" className={`pilla-boton${avanzadosAbiertos ? ' pilla-boton-activa' : ''}`} onClick={() => setAvanzadosAbiertos((previo) => !previo)} aria-expanded={avanzadosAbiertos}>
            <SlidersHorizontal/>
            Filtros avanzados
            <ChevronDown className={avanzadosAbiertos ? 'pilla-boton-flecha girada' : 'pilla-boton-flecha'}/>
          </button>

          <p className="filtros-resumen">
            <span className="filtros-resumen-cifra">{formatNumber(filtered.length)}</span>
            {filtered.length === 1 ? 'resultado' : 'resultados'} de{' '}
            {formatNumber(base.length)} contratos
          </p>

          <button type="button" className="limpiar-filtros" onClick={clearFilters} disabled={!hasFilters}>
            <FilterX/>
            Limpiar
          </button>
        </div>

        {avanzadosAbiertos ? (<div className="filtros-avanzados">
          <PillaFiltro etiqueta="Supervisor" valor={supervisorParam} opciones={opcionesSupervisorDesplegable} onChange={(valor) => updateParam('supervisor', valor)} activa={supervisorParam !== 'all'}/>

          <PillaFiltro etiqueta="Informe" valor={informe} opciones={INFORME_OPTIONS} onChange={(valor) => updateParam('informe', valor)} activa={informe !== 'all'}/>

          <PillaFiltro etiqueta="Alcance" valor={alcance} opciones={opcionesAlcance} onChange={(valor) => updateParam('alcance', valor)} activa={alcance !== 'todas'}/>

          <div className="filtros-avanzados-anios">
            <SelectorAnios opciones={opcionesAnio} valor={anios} onChange={setAniosParam} anioActual={new Date().getFullYear()} etiqueta="Años"/>
          </div>

          <PillaFiltro etiqueta="Orden" valor={orden} opciones={ORDEN_OPTIONS} onChange={(valor) => updateParam('orden', valor)} activa={orden !== 'fecha-desc'}/>
        </div>) : null}
      </div>

      <div className="bento-tabla">

        <div className="listado-cabecera">
          <div className="ajuste-minimo">
            <h2 className="card-title">Listado de contratos</h2>
            <p className="card-subtitle">
              Página {page} de {totalPages}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (<EmptyState title="No se encontraron contratos" description="Ajusta la búsqueda o limpia los filtros para ver más resultados." action={<button type="button" className="btn btn-ghost" onClick={clearFilters}>
                <FilterX/>
                Limpiar filtros
              </button>}/>) : (<>
            <div className="deslizable-x">
              <table className="tabla-listado">
                <thead>
                  <tr>
                    <th className="table-th">Contrato</th>
                    <th className="table-th">Contratista</th>
                    <th className="table-th">Supervisor</th>
                    <th className="table-th table-th-avance">Avance certificado</th>
                    <th className="table-th table-th-centro" title="Supervisiones registradas sobre los meses de vigencia del contrato">Supervisiones / ciclo</th>
                    <th className="table-th table-th-centro">Cuentas</th>
                    <th className="table-th">Fecha fin</th>
                    <th className="table-th">Estado</th>
                    <th className="table-th table-th-flecha" aria-label="Abrir"/>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((contrato) => (<tr key={`${contrato.noContrato ?? contrato.id}`} className="table-row" onClick={() => {
                    if (contrato.noContrato) {
                        navigate(`/contratos/${encodeURIComponent(contrato.noContrato)}`);
                    }
                }}>
                      <td className="table-td sin-ajuste celda-titulo">
                        {contrato.noContrato ? (<Link to={`/contratos/${encodeURIComponent(contrato.noContrato)}`} className="link" onClick={(event) => event.stopPropagation()}>
                            {contrato.noContrato}
                          </Link>) : ('—')}
                      </td>
                      <td className="table-td celda-contratista celda-recortada">
                        <span title={contrato.contratista ?? undefined}>
                          {truncate(contrato.contratista, 40)}
                        </span>
                      </td>
                      <td className="table-td celda-contratista celda-recortada">
                        <span title={contrato.supervisor ?? undefined}>
                          {contrato.supervisor?.trim() ? truncate(contrato.supervisor.trim(), 28) : '—'}
                        </span>
                      </td>
                      <td className="table-td" title={(contrato.avanceDeclarado ?? 0) > contrato.porcentajeAvance
                        ? `Declarado por el supervisor: ${contrato.avanceDeclarado}% · sin cuenta radicada que lo certifique`
                        : undefined}>
                        <ProgressBar value={contrato.porcentajeAvance} showLabel size="sm"/>
                      </td>
                      <td className="table-td sin-ajuste celda-cifra">
                        {contrato.totalSupervisiones}
                        <span className="cifra-parcial"> / {contrato.totalSupervisionesEsperadas}</span>
                      </td>
                      <td className="table-td sin-ajuste celda-cifra">
                        {contrato.cuentasRegistradas}
                        <span className="cifra-parcial"> / {contrato.cuentasEsperadas}</span>
                        {contrato.cuentasEnMora > 0 ? (<span className="marca-mora">
                            {contrato.cuentasEnMora} en mora
                          </span>) : null}
                      </td>
                      <td className="table-td celda-fecha">
                        {formatDate(contrato.fechaFin)}
                      </td>
                      <td className="table-td celda-amplia">
                        <EstadoBadge id={contrato.idEstadoActual} label={contrato.estadoActual}/>
                      </td>
                      <td className="table-td celda-flecha">
                        <ChevronRight/>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage}/>
          </>)}
      </div>
    </div>);
    return cuerpo;
}
