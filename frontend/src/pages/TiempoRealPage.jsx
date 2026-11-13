import { useMemo, useState } from 'react';
import { MapaBloques } from '@/components/cdc/MapaBloques';
import { PanelBloque } from '@/components/cdc/PanelBloque';
import { TrazabilidadCuenta } from '@/components/cdc/TrazabilidadCuenta';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { useCdc } from '@/hooks/useCdc';
import { useContratos } from '@/hooks/useContratos';
import {
    BLOQUES,
    bloquePorId,
    bloquePrincipal,
    conteoDeBloques,
    cuentasDeBloque,
    etiquetaCuenta,
} from '@/lib/bloques';
import { coincideTexto } from '@/lib/format';

/**
 * Una cuenta se marca como "viva" si su contrato tuvo un evento CDC en los
 * últimos dos minutos: es la señal de que acaba de moverse en el mapa.
 */
const VENTANA_VIVA = 120_000;

export function TiempoRealPage() {
    const { events } = useCdc();
    const contratosQuery = useContratos();
    const [bloqueSel, setBloqueSel] = useState(null);
    const [consulta, setConsulta] = useState('');
    const [seleccion, setSeleccion] = useState(null);

    const contratos = contratosQuery.data ?? [];

    // Conteo de todos los bloques en una pasada; solo cambia cuando llega un CDC.
    const { conteo, totales } = useMemo(() => conteoDeBloques(contratos), [contratos]);

    // El usuario aún no eligió bloque: se enfoca el que hoy tiene más cuentas.
    const bloqueId = bloqueSel ?? bloquePrincipal(conteo);
    const bloque = bloquePorId(bloqueId) ?? BLOQUES[0];

    // Listas solo del bloque activo: el resto del mapa vive solo en los contadores.
    const listas = useMemo(() => cuentasDeBloque(contratos, bloqueId), [contratos, bloqueId]);

    const listasFiltradas = useMemo(() => {
        const termino = consulta.trim();
        if (!termino) return listas;
        const coincide = (item) =>
            coincideTexto(
                termino,
                item.contrato?.noContrato,
                item.contrato?.contratista,
                item.contrato?.supervisor,
                etiquetaCuenta(item.cuenta),
            );
        return {
            curso: listas.curso.filter(coincide),
            devolucion: listas.devolucion.filter(coincide),
        };
    }, [listas, consulta]);

    // La selección se guarda como referencia (contrato + cuenta) y se resuelve
    // contra el bloque activo: si la cuenta ya no está aquí, se ignora.
    const cuentaSel = useMemo(() => {
        if (!seleccion) return null;
        const candidatas = [...listas.curso, ...listas.devolucion];
        return (
            candidatas.find(
                (item) =>
                    item.contrato?.noContrato === seleccion.contrato &&
                    item.cuenta.idInformeActividad === seleccion.cuenta,
            ) ?? null
        );
    }, [listas, seleccion]);

    const vivos = useMemo(() => {
        const limite = Date.now() - VENTANA_VIVA;
        const conjunto = new Set();
        for (const evento of events) {
            if (evento.timestamp >= limite) conjunto.add(evento.contrato);
        }
        return conjunto;
    }, [events]);

    if (contratosQuery.isLoading) {
        return (
            <div className="pila-pagina">
                <TableSkeleton rows={6} />
            </div>
        );
    }

    if (contratosQuery.isError) {
        return (
            <div className="pila-pagina">
                <ErrorState onRetry={contratosQuery.refetch} />
            </div>
        );
    }

    return (
        <div className="pila-pagina">
            <Card>
                <MapaBloques
                    conteo={conteo}
                    totales={totales}
                    seleccionado={bloqueId}
                    onSelect={setBloqueSel}
                />
            </Card>

            <div className="cuadricula-panel">
                <PanelBloque
                    bloque={bloque}
                    listas={listasFiltradas}
                    consulta={consulta}
                    onConsulta={setConsulta}
                    seleccion={seleccion}
                    onSelect={(item) =>
                        setSeleccion({
                            contrato: item.contrato?.noContrato,
                            cuenta: item.cuenta.idInformeActividad,
                        })
                    }
                    vivos={vivos}
                />
                <TrazabilidadCuenta item={cuentaSel} eventos={events} />
            </div>
        </div>
    );
}
