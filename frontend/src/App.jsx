import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
const ContratosPage = lazy(() => import('@/pages/ContratosPage').then((module) => ({ default: module.ContratosPage })));
const ContratoDetailPage = lazy(() => import('@/pages/ContratoDetailPage').then((module) => ({ default: module.ContratoDetailPage })));
const TiempoRealPage = lazy(() => import('@/pages/TiempoRealPage').then((module) => ({ default: module.TiempoRealPage })));
const AnaliticaPage = lazy(() => import('@/pages/AnaliticaPage').then((module) => ({ default: module.AnaliticaPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
function RouteFallback() {
    return (<div className="carga-ruta">
      <span className="spinner" role="status" aria-label="Cargando"/>
    </div>);
}
export default function App() {
    return (<Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/contratos" replace />}/>
          <Route path="contratos" element={<ContratosPage />}/>
          <Route path="contratos/:noContrato" element={<ContratoDetailPage />}/>
          <Route path="tiempo-real" element={<TiempoRealPage />}/>
          <Route path="analitica" element={<AnaliticaPage />}/>
          <Route path="supervision" element={<Navigate to="/analitica" replace/>}/>
          <Route path="*" element={<NotFoundPage />}/>
        </Route>
      </Routes>
    </Suspense>);
}
