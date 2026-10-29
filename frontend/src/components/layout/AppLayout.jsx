import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from '@/components/layout/Topbar';

export function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return (
    <div className="app-shell">
      <Topbar />

      <main className="app-main">
        <div className="route-fade-in">
          <Outlet />
        </div>
      </main>

      <footer className="app-footer">
        <span>GE-COR · Seguimiento de contratos</span>
        <span>Datos servidos por el backend Spring Boot + CDC Debezium</span>
      </footer>
    </div>
  );
}
