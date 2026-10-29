import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Página no encontrada"
        description="La ruta que buscas no existe o fue movida. Vuelve al listado de contratos para continuar."
        action={
          <Link to="/contratos" className="btn btn-primary">
            <Home />
            Ir a contratos
          </Link>
        }
      />
    </Card>
  );
}
