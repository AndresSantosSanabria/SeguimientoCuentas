import { Activity, BarChart3, FileText, Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { LogoApp } from '@/shared/components/ui';
import { useAuth } from '@/features/sesion/components/AuthProvider';

const NAV_ITEMS = [
  { to: '/contratos', label: 'Contratos', icon: FileText, permiso: 'CONTRATOS_VER' },
  { to: '/analitica', label: 'Analítica', icon: BarChart3, permiso: 'ANALITICA_VER' },
  { to: '/tiempo-real', label: 'Tiempo real', icon: Activity, permiso: 'TIEMPO_REAL_VER' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, permiso: 'USUARIOS_ADMINISTRAR' },
];

/**
 * Rail flotante de iconos: una capsula vertical fija de 56 px. No muestra
 * ningun texto; el nombre de cada seccion aparece como tooltip al pasar el
 * puntero. Los datos del usuario viven en el menu del avatar de la barra
 * superior.
 */
export function Sidebar() {
  const { puede } = useAuth();

  return (
    <aside className="lateral">
      <Link to="/contratos" className="lateral-marca" aria-label="Ir al listado de contratos" data-tooltip="GE-COR">
        <LogoApp alt="" className="lateral-logo" />
      </Link>

      <nav className="lateral-nav" aria-label="Navegación principal">
        {NAV_ITEMS.filter((item) => !item.permiso || puede(item.permiso)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="lateral-link"
              aria-label={item.label}
              data-tooltip={item.label}
            >
              <Icon />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
