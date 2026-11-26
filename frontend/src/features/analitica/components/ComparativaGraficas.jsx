import { useMemo } from 'react';
import { ChartCard } from '@/features/analitica/components/charts/ChartCard';
import { EjecucionSecretariasBars } from '@/features/analitica/components/charts/EjecucionSecretariasBars';
import { LeadTimeSecretariasBars } from '@/features/analitica/components/charts/LeadTimeSecretariasBars';
import { MoraMensualLineas } from '@/features/analitica/components/charts/MoraMensualLineas';
import { PercentilesTramiteBars } from '@/features/analitica/components/charts/PercentilesTramiteBars';
import {
    buildEjecucionSecretarias,
    buildLeadTimeSecretarias,
    buildMoraMensualSecretarias,
    buildPercentilesTramite,
} from '@/features/analitica/utils/comparativaGraficas';
import { dependenciaLabel } from '@/features/cuentas/utils/dependencias';
import { formatNumber, normalizar } from '@/shared/utils';

function CajaVacia({ titulo, detalle }) {
    return (
        <div className="caja-vacia caja-vacia-alta">
            <p className="caja-vacia-titulo">{titulo}</p>
            <p className="caja-vacia-detalle">{detalle}</p>
        </div>
    );
}

/**
 * Las cuatro gráficas que acompañan a la comparativa, con las secretarías
 * elegidas en las tarjetas de arriba. Se calculan sobre los contratos que la
 * página ya cargó (el espejo que el CDC mantiene en vivo) y con el mismo
 * período y alcance de la barra superior.
 */
export function ComparativaGraficas({ contratos = [], secretarias = [], alcance = 'curso', filtros = {}, hoy = new Date() }) {
    const seleccion = useMemo(() => {
        const claves = new Set(secretarias.map((nombre) => normalizar(nombre)));
        return (contratos ?? []).filter((contrato) => claves.has(normalizar(dependenciaLabel(contrato))));
    }, [contratos, secretarias]);

    // Secretarías elegidas sin ningún contrato en el ámbito de la persona:
    // la tarjeta las trae del índice completo, los contratos no.
    const sinContratos = useMemo(() => {
        const conDatos = new Set(seleccion.map((contrato) => normalizar(dependenciaLabel(contrato))));
        return secretarias.filter((nombre) => !conDatos.has(normalizar(nombre)));
    }, [seleccion, secretarias]);

    const ejecucion = useMemo(
        () => buildEjecucionSecretarias({ contratos: seleccion, secretarias, alcance, filtros, hoy }),
        [seleccion, secretarias, alcance, filtros, hoy],
    );
    const mora = useMemo(
        () => buildMoraMensualSecretarias({ contratos: seleccion, secretarias, alcance, filtros, hoy }),
        [seleccion, secretarias, alcance, filtros, hoy],
    );
    const leadTime = useMemo(
        () => buildLeadTimeSecretarias({ contratos: seleccion, secretarias, alcance, hoy }),
        [seleccion, secretarias, alcance, hoy],
    );
    const percentiles = useMemo(
        () => buildPercentilesTramite({ contratos: seleccion, secretarias, alcance, hoy }),
        [seleccion, secretarias, alcance, hoy],
    );

    const notaSinDatos = sinContratos.length > 0 ? `Sin contratos en tu ámbito para ${sinContratos.join(', ')}.` : '';
    const avisoAlcance = 'Ajusta el período o el alcance de cuentas (En curso, Cerradas o Ambas) de la barra superior.';

    return (
        <div className="cuadricula-panel">
            <ChartCard
                className="celda-col-larga"
                title="Ejecución de cuentas"
                subtitle="¿Quién radica y cobra mejor? Composición de las cuentas exigibles de cada secretaría al corte."
                contador={ejecucion.exigibles}
                footer={(
                    <p className="pie-analitico">
                        <span className="pie-analitico-cifra">{formatNumber(ejecucion.exigibles)}</span> cuentas
                        exigibles · completadas, en proceso, devueltas y mora suman el 100%
                        {notaSinDatos ? ` · ${notaSinDatos}` : ''}
                    </p>
                )}
            >
                {ejecucion.exigibles > 0
                    ? <EjecucionSecretariasBars data={ejecucion.rows} />
                    : <CajaVacia titulo="Sin cuentas exigibles en el período" detalle={avisoAlcance} />}
            </ChartCard>

            <ChartCard
                className="celda-col-media"
                title="Días de trámite: el típico y el lento"
                subtitle="Cuánto tarda en cerrarse la mitad de las cuentas (típico) frente a las que más se atrasan. Días contados desde el primer movimiento hasta el cierre, o hasta hoy si sigue abierta."
                contador={percentiles.cuentas}
                footer={(
                    <p className="pie-analitico">
                        <span className="pie-analitico-cifra">{formatNumber(percentiles.cuentas)}</span> cuentas
                        medidas · mientras más separadas estén las dos barras, más se traban algunas cuentas
                        {notaSinDatos ? ` · ${notaSinDatos}` : ''}
                    </p>
                )}
            >
                {percentiles.cuentas > 0
                    ? <PercentilesTramiteBars data={percentiles.rows} />
                    : <CajaVacia titulo="Sin cuentas con trazabilidad" detalle={avisoAlcance} />}
            </ChartCard>

            <ChartCard
                className="celda-col-larga"
                title="Tasa de mora mensual"
                subtitle="¿Quién está cerrando la brecha? Porcentaje de cuentas exigibles que cerraron cada mes sin cuenta radicada."
                contador={`${mora.meses} ${mora.meses === 1 ? 'mes' : 'meses'}`}
                footer={(
                    <p className="pie-analitico">
                        <span className="pie-analitico-cifra">{formatNumber(mora.meses)}</span>
                        {mora.meses === 1 ? ' mes' : ' meses'} del período
                        {mora.recortado ? ' · se muestran los últimos 36 meses' : ''}
                        {notaSinDatos ? ` · ${notaSinDatos}` : ''}
                    </p>
                )}
            >
                {mora.puntos.length > 0 && mora.series.length > 0
                    ? <MoraMensualLineas puntos={mora.puntos} series={mora.series} />
                    : <CajaVacia titulo="Sin meses con cuentas exigibles" detalle={avisoAlcance} />}
            </ChartCard>

            <ChartCard
                className="celda-col-media"
                title="Lead time por secretaría"
                subtitle="Días promedio de una cuenta en cada etapa: tiempo con valor (procesamiento y entrega) frente a tiempo muerto (aprobación y cola)."
                contador={leadTime.cuentas}
                footer={(
                    <p className="pie-analitico">
                        <span className="pie-analitico-cifra">{formatNumber(leadTime.cuentas)}</span>
                        {leadTime.cuentas === 1 ? ' cuenta' : ' cuentas'} · promedio por cuenta
                        {notaSinDatos ? ` · ${notaSinDatos}` : ''}
                    </p>
                )}
            >
                {leadTime.cuentas > 0
                    ? <LeadTimeSecretariasBars data={leadTime.rows} />
                    : <CajaVacia titulo="Sin cuentas con trazabilidad" detalle={avisoAlcance} />}
            </ChartCard>
        </div>
    );
}
