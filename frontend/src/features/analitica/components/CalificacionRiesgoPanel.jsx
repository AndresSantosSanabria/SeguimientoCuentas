import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { EmptyState, Pagination } from '@/shared/components/ui';
import { formatNumber, truncate } from '@/shared/utils';

/**
 * Calificación y riesgo de los contratistas: el reparto por nivel de calificación, el reparto por
 * riesgo de incumplimiento y los contratos donde más se ve el problema. Cada pastilla filtra la
 * tabla de abajo, que se recorre por páginas para no crecer sin límite.
 */
export function CalificacionRiesgoPanel({ datos, alVerContrato, paginaSize = 10 }) {
    const [nivelActivo, setNivelActivo] = useState(null);
    const [riesgoActivo, setRiesgoActivo] = useState(null);
    const [pagina, setPagina] = useState(1);

    const detalle = useMemo(() => {
        const todas = datos?.detalle ?? [];
        return todas.filter((fila) => (nivelActivo ? fila.nivel === nivelActivo : true)
            && (riesgoActivo ? fila.riesgo === riesgoActivo : true));
    }, [datos, nivelActivo, riesgoActivo]);

    // El filtro cambia el universo de la tabla: la paginación vuelve al inicio.
    useEffect(() => {
        setPagina(1);
    }, [nivelActivo, riesgoActivo]);

    if (!datos || datos.detalle.length === 0) {
        return (
            <EmptyState
                icon={ShieldAlert}
                title="Sin calificación registrada"
                description="Los contratos del universo medido todavía no tienen calificación ni riesgo de incumplimiento."
            />
        );
    }

    const hayFiltro = Boolean(nivelActivo || riesgoActivo);
    const totalPaginas = Math.max(1, Math.ceil(detalle.length / paginaSize));
    const paginaActual = Math.min(pagina, totalPaginas);
    const desde = (paginaActual - 1) * paginaSize;
    const filas = detalle.slice(desde, desde + paginaSize);
    const conNivel = datos.totalNivel;
    const conRiesgo = datos.totalRiesgo;

    return (
        <div className="calificacion-panel">
            <div className="medida-bloque">
                <div className="medida-encabezado">
                    <span className="medida-titulo">Calificación</span>
                    <span className="medida-conteo">
                        {formatNumber(conNivel)} contratos calificados
                    </span>
                </div>
                <div className="medida-fila">
                    {datos.resumenNiveles.map((item) => (
                        <FiltroPastilla
                            key={item.nivel}
                            activo={nivelActivo === item.nivel}
                            tono={item.tone}
                            etiqueta={item.nivel}
                            nota={item.label}
                            total={item.total}
                            porCento={conNivel > 0 ? (item.total / conNivel) * 100 : 0}
                            alCambiar={() => setNivelActivo(nivelActivo === item.nivel ? null : item.nivel)}
                        />
                    ))}
                </div>
            </div>

            <div className="medida-bloque">
                <div className="medida-encabezado">
                    <span className="medida-titulo">Riesgo de incumplimiento</span>
                    <span className="medida-conteo">
                        {formatNumber(conRiesgo)} contratos con riesgo registrado
                    </span>
                </div>
                <div className="medida-fila">
                    {datos.resumenRiesgos.map((item) => (
                        <FiltroPastilla
                            key={item.valor}
                            activo={riesgoActivo === item.valor}
                            tono={item.tone}
                            etiqueta={item.valor}
                            total={item.total}
                            porCento={conRiesgo > 0 ? (item.total / conRiesgo) * 100 : 0}
                            alCambiar={() => setRiesgoActivo(riesgoActivo === item.valor ? null : item.valor)}
                        />
                    ))}
                </div>
            </div>

            {hayFiltro ? (
                <div className="medida-filtro-activo">
                    <span className="medida-filtro-texto">
                        {`Filtrando por${nivelActivo ? ` calificación ${nivelActivo}` : ''}${nivelActivo && riesgoActivo ? ' y' : ''}${riesgoActivo ? ` riesgo ${riesgoActivo.toLowerCase()}` : ''} · ${formatNumber(detalle.length)} ${detalle.length === 1 ? 'contrato' : 'contratos'}`}
                    </span>
                    <button type="button" className="medida-filtro-limpiar" onClick={() => {
                        setNivelActivo(null);
                        setRiesgoActivo(null);
                    }}>
                        <X/>
                        Quitar filtro
                    </button>
                </div>
            ) : null}

            {filas.length === 0 ? (<EmptyState
                icon={ShieldAlert}
                title="Sin contratos con esa combinación"
                description="Prueba con otro nivel de calificación u otro nivel de riesgo."
            />) : (<div className="deslizable-x">
                <table className="tabla-listado tabla-listado-estrecho">
                    <thead>
                        <tr>
                            <th className="table-th">Contrato</th>
                            <th className="table-th">Contratista</th>
                            <th className="table-th">Calificación</th>
                            <th className="table-th">Riesgo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((fila) => (
                            <tr key={fila.noContrato} className="table-row" onClick={() => alVerContrato?.(fila.noContrato)}>
                                <td className="table-td sin-ajuste celda-titulo">{fila.noContrato}</td>
                                <td className="table-td celda-amplia celda-recortada">
                                    <span title={fila.contratista ?? undefined}>
                                        {truncate(fila.contratista, 32)}
                                    </span>
                                </td>
                                <td className="table-td">
                                    {fila.nivel ? (
                                        <span className="estado-badge" data-tone={tonoNivel(fila.nivel)} title={fila.puntajeLabel ?? undefined}>
                                            <span className="estado-badge-texto">
                                                {fila.nivel} · {fila.puntajeLabel ?? ''}
                                            </span>
                                        </span>
                                    ) : ('—')}
                                </td>
                                <td className="table-td">
                                    {fila.riesgo ? (
                                        <span className="estado-badge" data-tone={tonoRiesgo(fila.riesgo)} title={fila.explicacion ?? undefined}>
                                            <span className="estado-badge-texto">{fila.riesgo}</span>
                                        </span>
                                    ) : ('—')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>)}

            {detalle.length > paginaSize ? (
                <div className="medida-paginacion">
                    <Pagination
                        page={paginaActual}
                        pageSize={paginaSize}
                        total={detalle.length}
                        onPageChange={setPagina}
                    />
                </div>
            ) : null}
        </div>
    );
}

/** Pastilla que sirve de filtro rápido: la parte de color es el nivel y el número, su peso. */
function FiltroPastilla({ activo, tono, etiqueta, nota, total, porCento, alCambiar }) {
    return (
        <button
            type="button"
            className={`medida-pastilla${activo ? ' medida-pastilla-activa' : ''}`}
            data-tone={tono}
            aria-pressed={activo}
            onClick={alCambiar}
            title={nota ? `${etiqueta} · ${nota}` : etiqueta}
        >
            <span className="medida-linea">
                <span className="medida-punto" aria-hidden="true"/>
                <span className="medida-clave">{etiqueta}</span>
                {nota ? (<span className="medida-nota">{nota}</span>) : null}
                <span className="medida-valor">{formatNumber(total)}</span>
            </span>
            <span className="medida-barra" aria-hidden="true">
                <span className="medida-barra-relleno" style={{ width: `${Math.min(100, Math.max(2, porCento))}%` }}/>
            </span>
        </button>
    );
}

function tonoNivel(nivel) {
    if (nivel === 'D') return 'danger';
    if (nivel === 'C') return 'warning';
    if (nivel === 'B') return 'info';
    return 'success';
}

function tonoRiesgo(riesgo) {
    if (riesgo === 'Alto') return 'danger';
    if (riesgo === 'Medio') return 'warning';
    if (riesgo === 'Bajo') return 'info';
    return 'success';
}
