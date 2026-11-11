import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequirePermiso } from '@/auth/RequirePermiso';
import { AppLayout } from '@/components/layout/AppLayout';
import { LogoApp } from '@/components/ui/LogoApp';
const CallbackPage = lazy(() => import('@/pages/CallbackPage').then((module) => ({ default: module.CallbackPage })));
const ContratosPage = lazy(() => import('@/pages/ContratosPage').then((module) => ({ default: module.ContratosPage })));
const ContratoDetailPage = lazy(() => import('@/pages/ContratoDetailPage').then((module) => ({ default: module.ContratoDetailPage })));
const TiempoRealPage = lazy(() => import('@/pages/TiempoRealPage').then((module) => ({ default: module.TiempoRealPage })));
const AnaliticaPage = lazy(() => import('@/pages/AnaliticaPage').then((module) => ({ default: module.AnaliticaPage })));
const ConfiguracionPage = lazy(() => import('@/pages/ConfiguracionPage').then((module) => ({ default: module.ConfiguracionPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
function RouteFallback() {
    return (<div className="carga-ruta" role="status" aria-label="Cargando">
      <div className="carga-ruta-marca">
        <span className="carga-ruta-logo"><LogoApp /></span>
        <span className="carga-ruta-nombre">GE-COR</span>
      </div>
      <span className="carga-ruta-linea" aria-hidden="true"/>
    </div>);
}
export default function App() {
    // React ya pinto: retirar la pantalla de arranque de index.html con
    // una transicion suave en lugar de un corte seco.
    useEffect(() => {
        if (window.__ocultarArranque) {
            window.__ocultarArranque();
        } else {
            document.getElementById('boot')?.remove();
        }
    }, []);
    return (<Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Callback de OIDC: fuera del layout y sin proteger (es la llegada del login). */}
        <Route path="callback" element={<CallbackPage />}/>
        <Route element={<AppLayout />}>
          {/* Todo el contenido exige sesion: sin token Keycloak manda al login. */}
          <Route element={<RequireAuth />}>
            <Route index element={<Navigate to="/contratos" replace />}/>
            <Route path="contratos" element={<RequirePermiso permiso="CONTRATOS_VER"><ContratosPage /></RequirePermiso>}/>
            <Route path="contratos/:noContrato" element={<RequirePermiso permiso="CONTRATOS_VER"><RequirePermiso permiso="CONTRATOS_VER_DETALLE"><ContratoDetailPage /></RequirePermiso></RequirePermiso>}/>
            <Route path="tiempo-real" element={<RequirePermiso permiso="TIEMPO_REAL_VER"><TiempoRealPage /></RequirePermiso>}/>
            <Route path="analitica" element={<RequirePermiso permiso="ANALITICA_VER"><AnaliticaPage /></RequirePermiso>}/>
            <Route path="configuracion" element={<RequirePermiso permiso="USUARIOS_ADMINISTRAR"><ConfiguracionPage /></RequirePermiso>}/>
            <Route path="supervision" element={<Navigate to="/analitica" replace/>}/>
            <Route path="*" element={<NotFoundPage />}/>
          </Route>
        </Route>
      </Routes>
    </Suspense>);
}
