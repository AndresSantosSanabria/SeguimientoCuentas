import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FlujoCuentaDiagrama } from '@/components/FlujoCuentaDiagrama';
import '@/styles/index.css';

const CUENTAS = {
  157: [1, 2, 4],
  160: [1, 2, 3, 2, 5, 6, 7, 9, 11, 12, 13],
  154: [2, 5, 6, 7, 9, 11, 12, 13, 19],
};

const pasos = CUENTAS[Number(new URLSearchParams(location.search).get('c') ?? 157)].map(
  (e) => ({ idEstado: e, estado: `E${e}`, fecha: null, descripcion: '' }),
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div style={{ padding: '1rem' }}>
      <FlujoCuentaDiagrama pasos={pasos} enTramite />
    </div>
  </StrictMode>,
);
