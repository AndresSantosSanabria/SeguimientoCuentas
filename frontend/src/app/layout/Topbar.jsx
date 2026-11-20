import { Bell, LogOut, RefreshCw, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { CdcStatusPill } from '@/features/cdc';
import { queryKeys } from '@/shared/services';
import { useAuth } from '@/features/sesion/components/AuthProvider';

function seccionDe(ruta) {
  if (ruta.startsWith('/analitica')) return 'Analítica';
  if (ruta.startsWith('/tiempo-real')) return 'Tiempo real';
  if (ruta.startsWith('/configuracion')) return 'Configuración';
  if (ruta.startsWith('/contratos/')) return 'Detalle del contrato';
  if (ruta.startsWith('/contratos')) return 'Contratos';
  return 'GE-COR';
}

/**
 * Barra superior minima: migas a la izquierda, buscador global al centro y
 * los avisos de estado a la derecha. No lleva fondo propio: se apoya en el
 * lienzo de la pagina.
 */
export function Topbar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { enabled: authEnabled, nombre, correo, rol, secretarias, verTodasSecretarias, logout } = useAuth();
  const fetching = useIsFetching({ queryKey: queryKeys.contratos }) > 0;
  const [busqueda, setBusqueda] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);
  const seccion = seccionDe(pathname);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const cerrar = (evento) => {
      if (!menuRef.current?.contains(evento.target)) setMenuAbierto(false);
    };
    document.addEventListener('pointerdown', cerrar);
    return () => document.removeEventListener('pointerdown', cerrar);
  }, [menuAbierto]);

  const alcance = verTodasSecretarias
    ? 'Todas las secretarías'
    : (secretarias ?? []).length > 0
      ? secretarias.join(' · ')
      : 'Sin secretaría asignada';

  const buscar = (evento) => {
    evento.preventDefault();
    const texto = busqueda.trim();
    navigate(texto ? `/contratos?q=${encodeURIComponent(texto)}` : '/contratos');
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-contexto">
          <span className="topbar-contexto-titulo">{seccion}</span>
        </div>

        <form className="topbar-buscador" role="search" onSubmit={buscar}>
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar contratos, secretarías..."
            aria-label="Buscar contratos y secretarías"
          />
          <button type="submit" className="topbar-buscador-lupa" aria-label="Buscar" title="Buscar">
            <Search />
          </button>
        </form>

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

          <button type="button" className="topbar-campana" aria-label="Notificaciones" title="Notificaciones">
            <Bell />
          </button>

          {authEnabled && (
            <div className="topbar-sesion" ref={menuRef}>
              <button
                type="button"
                className="topbar-avatar"
                onClick={() => setMenuAbierto((abierto) => !abierto)}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                aria-label="Menú de usuario"
                title={`${correo || nombre}${rol?.nombre ? ` · ${rol.nombre}` : ''}`}
              >
                <User />
              </button>

              {menuAbierto && (
                <div className="topbar-menu" role="menu">
                  <div className="topbar-menu-cabecera">
                    <span className="topbar-menu-nombre">{nombre || 'Sesión activa'}</span>
                    <span className="topbar-menu-correo">{correo || '—'}</span>
                  </div>
                  <div className="topbar-menu-dato">
                    <span className="topbar-menu-etiqueta">Rol</span>
                    <span className="topbar-menu-valor">{rol?.nombre || 'Sin rol asignado'}</span>
                  </div>
                  <div className="topbar-menu-dato">
                    <span className="topbar-menu-etiqueta">Alcance</span>
                    <span className="topbar-menu-valor">{alcance}</span>
                  </div>
                  <button
                    type="button"
                    className="topbar-menu-salir"
                    role="menuitem"
                    onClick={() => logout()}
                  >
                    <LogOut />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
