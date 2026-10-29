import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/format';

function pageWindow(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('ellipsis');
  for (let current = start; current <= end; current += 1) pages.push(current);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="paginacion">
      <p className="paginacion-resumen">
        Mostrando <span className="paginacion-cifra">{formatNumber(from)}</span>–
        <span className="paginacion-cifra">{formatNumber(to)}</span> de{' '}
        <span className="paginacion-cifra">{formatNumber(total)}</span> contratos
      </p>

      <div className="paginacion-botones">
        <button
          type="button"
          className="btn btn-ghost btn-cuadrado"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </button>

        {pageWindow(page, totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="paginacion-omision">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className="paginacion-numero"
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          className="btn btn-ghost btn-cuadrado"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
