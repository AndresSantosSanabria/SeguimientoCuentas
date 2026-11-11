import { Activity, BarChart3, FileText, LogOut, RefreshCw, Settings, User } from 'lucide-react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink } from 'react-router-dom';
import { CdcStatusPill } from '@/components/cdc/CdcStatusPill';
import { queryKeys } from '@/api/queryKeys';
import { LogoApp } from '@/components/ui/LogoApp';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { to: '/contratos', label: 'Contratos', icon: FileText, permiso: 'CONTRATOS_VER' },
  { to: '/analitica', label: 'Analítica', icon: BarChart3, permiso: 'ANALITICA_VER' },
  { to: '/tiempo-real', label: 'Tiempo real', icon: Activity, permiso: 'TIEMPO_REAL_VER' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, permiso: 'USUARIOS_ADMINISTRAR' },
];

export function Topbar() {
  const queryClient = useQueryClient();
  const { enabled: authEnabled, nombre, correo, rol, secretarias, verTodasSecretarias, puede, logout } = useAuth();
  const fetching = useIsFetching({ queryKey: queryKeys.contratos }) > 0;
  const alcance = verTodasSecretarias
    ? 'Todas las secretarías'
    : secretarias.length > 0
      ? secretarias.join(' · ')
      : 'Sin secretaría asignada';
  return (
    <header className="topbar">
      <div className="topbar-brillo" />

      <div className="topbar-inner">
        <Link to="/contratos" className="topbar-marca" aria-label="Ir al listado de contratos">
          <LogoApp alt="" className="topbar-marca-logo" />
          <span className="topbar-marca-texto">
            <span className="topbar-marca-titulo">GE-COR</span>
            <span className="topbar-marca-sub">Seguimiento de contratos</span>
          </span>
        </Link>

        <span className="topbar-divider" aria-hidden="true" />

        <div className="topbar-acciones">
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

          {authEnabled && (
            <div className="topbar-sesion" title={`${correo || nombre}${rol?.nombre ? ` · ${rol.nombre}` : ''}`}>
              <span className="topbar-sesion-avatar" aria-hidden="true">
                <User />
              </span>
              <span className="topbar-sesion-nombre">{nombre}</span>
              {rol?.nombre ? <span className="topbar-sesion-rol">{rol.nombre}</span> : null}
              <span className="topbar-sesion-alcance" title={alcance}>
                {alcance}
              </span>
              <button
                type="button"
                className="topbar-recarga"
                onClick={() => logout()}
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
              >
                <LogOut />
              </button>
            </div>
          )}
        </div>

        <nav className="topbar-nav" aria-label="Navegación principal">
          {NAV_ITEMS.filter((item) => !item.permiso || puede(item.permiso)).map((item) => {
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
