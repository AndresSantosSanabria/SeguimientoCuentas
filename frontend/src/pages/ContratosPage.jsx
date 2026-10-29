import { ChevronRight, Download, FilterX, Search, SlidersHorizontal, } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EstadoBadge } from '@/components/ui/EstadoBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { useContratos } from '@/hooks/useContratos';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ALERTA_OPTIONS, AVANCE_OPTIONS, ORDEN_OPTIONS, compareContratos, isAlertaFiltro, isAvanceFiltro, isOrdenFiltro, matchesAlerta, matchesAvance, } from '@/lib/contratosFilters';
import { downloadCsv } from '@/lib/csv';
import { estadoLabel } from '@/lib/estados';
import { formatDate, formatNumber, truncate } from '@/lib/format';
const PAGE_SIZE = 20;
export function ContratosPage() {
    const { data, isLoading, isError, refetch } = useContratos();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const qParam = searchParams.get('q') ?? '';
    const estadoParam = searchParams.get('estado') ?? 'all';
    const avanceParam = searchParams.get('avance');
    const alertaParam = searchParams.get('alerta');
    const ordenParam = searchParams.get('orden');
    const pageParam = Number(searchParams.get('page') ?? '1');
    const avance = isAvanceFiltro(avanceParam) ? avanceParam : 'all';
    const alerta = isAlertaFiltro(alertaParam) ? alertaParam : 'all';
    const orden = isOrdenFiltro(ordenParam) ? ordenParam : 'fecha-desc';
    const [searchInput, setSearchInput] = useState(qParam);
    const debouncedSearch = useDebouncedValue(searchInput.trim(), 250);
    useEffect(() => {
        setSearchInput(qParam);
    }, [qParam]);
    useEffect(() => {
        if (debouncedSearch === qParam)
            return;
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (debouncedSearch)
                next.set('q', debouncedSearch);
            else
                next.delete('q');
            next.delete('page');
            return next;
        }, { replace: true });
    }, [debouncedSearch, qParam, setSearchParams]);
    const updateParam = (key, value) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (!value || value === 'all')
                next.delete(key);
            else
                next.set(key, value);
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
    const filtered = useMemo(() => {
        if (!data)
            return [];
        const query = debouncedSearch.toUpperCase();
        return data
            .filter((contrato) => {
            if (query) {
                const haystack = `${contrato.noContrato ?? ''} ${contrato.contratista ?? ''}`.toUpperCase();
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
            return true;
        })
            .sort((a, b) => compareContratos(a, b, orden));
    }, [data, debouncedSearch, estadoParam, avance, alerta, orden]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, Number.isFinite(pageParam) ? pageParam : 1), totalPages);
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasFilters = Boolean(qParam) || estadoParam !== 'all' || avance !== 'all' || alerta !== 'all' || orden !== 'fecha-desc';
    const clearFilters = () => {
        setSearchParams({}, { replace: true });
        setSearchInput('');
    };
    const handleExport = () => {
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`contratos-${stamp}.csv`, [
            'No. contrato',
            'Contratista',
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
    if (isLoading) {
        return (<div className="pila-pagina-amplia">
        <PageHeader eyebrow="Explorador" title="Contratos" description="Cargando el listado de contratos…"/>
        <TableSkeleton rows={10}/>
      </div>);
    }
    if (isError || !data) {
        return (<div className="pila-pagina-amplia">
        <PageHeader eyebrow="Explorador" title="Contratos"/>
        <ErrorState onRetry={() => refetch()}/>
      </div>);
    }
    return (<div className="pila-pagina">
      <PageHeader eyebrow="Explorador" title="Contratos" description="Consulta el último contrato registrado por cada contratista. Filtra por estado, avance o alertas operativas." actions={<button type="button" className="btn btn-primary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download/>
            Exportar CSV
            <span className="btn-contador">
              {formatNumber(filtered.length)}
            </span>
          </button>}/>

      <Card>
        <div className="filtros-grid">
          <label className="campo-filtro">
            <span className="field-label field-label-espaciado">
              Estado
            </span>
            <select className="input" value={estadoParam} onChange={(event) => updateParam('estado', event.target.value)}>
              <option value="all">Todos los estados</option>
              {estados.map(([id, label]) => (<option key={id} value={String(id)}>
                  {label}
                </option>))}
            </select>
          </label>

          <label className="campo-filtro">
            <span className="field-label field-label-espaciado">
              Avance
            </span>
            <select className="input" value={avance} onChange={(event) => updateParam('avance', event.target.value)}>
              {AVANCE_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                  {option.label}
                </option>))}
            </select>
          </label>

          <label className="campo-filtro">
            <span className="field-label field-label-espaciado">
              Alerta
            </span>
            <select className="input" value={alerta} onChange={(event) => updateParam('alerta', event.target.value)}>
              {ALERTA_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                  {option.label}
                </option>))}
            </select>
          </label>

          <label className="campo-filtro">
            <span className="field-label field-label-espaciado">
              Orden
            </span>
            <select className="input" value={orden} onChange={(event) => updateParam('orden', event.target.value)}>
              {ORDEN_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                  {option.label}
                </option>))}
            </select>
          </label>
        </div>

        <div className="filtros-barra">
          <p className="filtros-resumen">
            <SlidersHorizontal/>
            <span className="filtros-resumen-cifra">{formatNumber(filtered.length)}</span>
            {filtered.length === 1 ? 'resultado' : 'resultados'} de{' '}
            {formatNumber(data.length)} contratos
          </p>
          <button type="button" className="limpiar-filtros" onClick={clearFilters} disabled={!hasFilters}>
            <FilterX/>
            Limpiar filtros
          </button>
        </div>
      </Card>

      <Card className="card-recortada">
        <div className="listado-cabecera">
          <div className="ajuste-minimo">
            <h2 className="card-title">Listado de contratos</h2>
            <p className="card-subtitle">
              Página {page} de {totalPages}
            </p>
          </div>
          <label className="busqueda-listado">
            <Search className="input-icono"/>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="input input-corto input-con-icono" placeholder="Buscar contrato o contratista…" aria-label="Buscar en el listado de contratos"/>
          </label>
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
                    <th className="table-th table-th-avance">Avance certificado</th>
                    <th className="table-th table-th-centro">Supervisión</th>
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
      </Card>
    </div>);
}
