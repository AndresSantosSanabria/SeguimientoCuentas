import { Link } from 'react-router-dom';
import { useCdc } from '@/hooks/useCdc';

const STATUS_LABELS = {
  connected: 'CDC en línea',
  connecting: 'Conectando CDC',
  disconnected: 'CDC desconectado',
};

export function CdcStatusPill() {
  const { status } = useCdc();
  return (
    <Link
      to="/tiempo-real"
      data-cdc={status}
      className="pildora-cdc"
      title="Abrir el monitoreo en tiempo real"
    >
      <span className="pildora-cdc-punto">
        {status === 'connected' ? <span className="pildora-cdc-latido" /> : null}
        <span className={status === 'connecting' ? 'pildora-cdc-nucleo parpadeo' : 'pildora-cdc-nucleo'} />
      </span>
      <span>{STATUS_LABELS[status]}</span>
    </Link>
  );
}
