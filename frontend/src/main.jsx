import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import { CdcProvider } from '@/hooks/useCdc';
import '@/styles/index.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
createRoot(document.getElementById('root')).render(<StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider fuera del router: gates el arranque hasta cargar la sesion,
          asi el WebSocket CDC ya conecta con el token cacheado. */}
      <AuthProvider>
        <BrowserRouter>
          <CdcProvider>
            <App />
          </CdcProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>);
