import { Activity, BarChart3, FileText, Landmark, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CdcStatusPill } from '@/components/cdc/CdcStatusPill';
import { queryKeys } from '@/api/queryKeys';

const NAV_ITEMS = [
  { to: '/contratos', label: 'Contratos', icon: FileText },
  { to: '/analitica', label: 'Analítica', icon: BarChart3 },
  { to: '/tiempo-real', label: 'Tiempo real', icon: Activity },
];

export function Topbar() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: queryKeys.contratos }) > 0;
  const handleSubmit = (event) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/contratos?q=${encodeURIComponent(query)}` : '/contratos');
  };
  return (
    <header className="topbar">
      <div className="topbar-brillo" />

      <div className="topbar-inner">
        <Link to="/contratos" className="topbar-marca" aria-label="Ir al listado de contratos">
          <span className="topbar-marca-icono">
            <Landmark />
          </span>
          <span className="topbar-marca-texto">
            <span className="topbar-marca-titulo">GE-COR</span>
            <span className="topbar-marca-sub">Seguimiento de contratos</span>
          </span>
        </Link>

        <span className="topbar-divider" aria-hidden="true" />

        <div className="topbar-acciones">
          <form onSubmit={handleSubmit} className="topbar-busqueda">
            <label className="topbar-busqueda-label">
              <Search className="topbar-busqueda-icono" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="topbar-busqueda-campo"
                placeholder="Buscar contrato…"
                aria-label="Buscar contrato"
              />
            </label>
          </form>

          <CdcStatusPill />

          <button
            type="button"
            className="topbar-recarga"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.contratos })}
            disabled={fetching}
            aria-label="Actualizar datos"
            title="Actualizar datos"
          >
            <RefreshCw className={fetching ? 'girando' : undefined} />
          </button>
        </div>

        <nav className="topbar-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} className="topbar-link">
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
