import { ArrowLeftRight, Plus, Scale, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/shared/components/ui';
import { Card, CardHeader } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/ui';
import { Modal } from '@/shared/components/ui';
import { ProgressBar } from '@/shared/components/ui';
import { formatMoneda, formatNumber, formatPercent, normalizar } from '@/shared/utils';

/** Las cifras que se comparan: el proceso de cobro de cada secretaría. */
const METRICAS = [
    { clave: 'contratos', etiqueta: 'Contratos', formato: (valor) => formatNumber(valor) },
    { clave: 'radicadas', etiqueta: 'Cuentas radicadas', formato: (valor) => formatNumber(valor) },
    { clave: 'exigibles', etiqueta: 'Cuentas exigibles', formato: (valor) => formatNumber(valor) },
    { clave: 'pendientes', etiqueta: 'Cuentas pendientes', formato: (valor) => formatNumber(valor) },
    { clave: 'contratosConMora', etiqueta: 'Contratos con mora', formato: (valor) => formatNumber(valor) },
];

const MAX_COMPARADAS = 2;

function TarjetaSecretaria({ datos, titulo, onCambiar }) {
    if (!datos) {
        return (
            <div className="comparativa-tarjeta comparativa-tarjeta-vacia">
                <p className="comparativa-tarjeta-titulo">{titulo}</p>
                <button type="button" className="btn btn-secundario" onClick={onCambiar}>
                    Elegir secretaría
                </button>
            </div>
        );
    }
    const cobertura = Number.isFinite(datos.cobertura) ? datos.cobertura : 0;
    return (
        <div className="comparativa-tarjeta">
            <div className="comparativa-tarjeta-cabecera">
                <p className="comparativa-tarjeta-titulo">{titulo}</p>
                <p className="comparativa-tarjeta-nombre">{datos.secretaria}</p>
            </div>
            <div className="comparativa-cobertura">
                <div className="comparativa-cobertura-texto">
                    <span className="comparativa-cobertura-valor">{formatPercent(cobertura, 1)}</span>
                    <span className="comparativa-cobertura-etiqueta">de cobertura</span>
                </div>
                <ProgressBar value={cobertura} size="sm" />
            </div>
            <dl className="comparativa-metricas">
                {METRICAS.map((metrica) => {
                    const valor = datos[metrica.clave] ?? 0;
                    return (
                        <div key={metrica.clave} className="comparativa-metrica">
                            <dt>{metrica.etiqueta}</dt>
                            <dd>{metrica.formato(valor)}</dd>
                        </div>
                    );
                })}
                <div className="comparativa-metrica">
                    <dt>Presupuesto</dt>
                    <dd>{datos.valorTotal ? formatMoneda(datos.valorTotal) : '—'}</dd>
                </div>
            </dl>
            {onCambiar ? (
                <button type="button" className="btn btn-secundario comparativa-cambiar" onClick={onCambiar}>
                    <ArrowLeftRight />
                    Comparar otra secretaría
                </button>
            ) : null}
        </div>
    );
}

/**
 * Comparativa de secretarías: la secretaría donde está la persona frente a una o
 * dos que ella elige. Solo datos agregados: nunca el detalle de los contratos ajenos.
 *
 * La secretaría de referencia es la asignada en la sesión; si la persona no tiene
 * ninguna asignada (administradores), la referencia se elige a mano.
 */
export function ComparativaSecretarias({ filas = [], cargando, error, onReintentar, misSecretarias = [] }) {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [destino, setDestino] = useState(null);
    const [baseElegida, setBaseElegida] = useState(null);
    const [slots, setSlots] = useState(null);
    const [busqueda, setBusqueda] = useState('');

    // El orden es por carga de cobro pendiente, el mismo criterio de la grafica
    // «Cuentas por secretaria», para que el bloque abra con las secretarias de mayor proceso.
    const ordenadas = useMemo(() => [...filas].sort((a, b) => (b.pendientes ?? 0) - (a.pendientes ?? 0)
        || (b.contratos ?? 0) - (a.contratos ?? 0)
        || String(a.secretaria ?? '').localeCompare(String(b.secretaria ?? ''), 'es')), [filas]);

    const porNombre = useMemo(() => {
        const mapa = new Map();
        for (const fila of filas) {
            mapa.set(fila.secretaria, fila);
        }
        return mapa;
    }, [filas]);

    // Las secretarías asignadas a la persona llegan como codigo o como nombre: se
    // comparan sin tildes ni mayusculas para cruzarlas con las filas de la comparativa.
    const clavesMias = useMemo(() => new Set(misSecretarias.map((valor) => normalizar(valor)).filter(Boolean)),
        [misSecretarias]);

    const mias = useMemo(() => ordenadas.filter((fila) => clavesMias.has(normalizar(fila.secretaria))),
        [ordenadas, clavesMias]);

    // Por omision se compara contra la secretaría con más proceso que no sea la propia.
    const porDefecto = useMemo(() => {
        const conDatos = ordenadas.filter((fila) => (fila.contratos ?? 0) > 0);
        const basePropia = mias.length === 0 ? (conDatos[0]?.secretaria ?? null) : null;
        const libres = conDatos.filter((fila) => !clavesMias.has(normalizar(fila.secretaria))
            && normalizar(fila.secretaria) !== normalizar(basePropia ?? ''));
        return {
            base: basePropia,
            comparadas: libres.slice(0, 1).map((fila) => fila.secretaria),
        };
    }, [ordenadas, mias, clavesMias]);

    const baseNombre = mias.length > 0 ? null : (baseElegida ?? porDefecto.base);
    const comparadas = slots ?? porDefecto.comparadas;
    const base = baseNombre ? (porNombre.get(baseNombre) ?? null) : null;

    const candidatas = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return ordenadas.filter((fila) => {
            if (!texto) return true;
            return normalizar(fila.secretaria)?.includes(texto);
        });
    }, [ordenadas, busqueda]);

    const abrirModal = (nuevoDestino) => {
        setDestino(nuevoDestino);
        setBusqueda('');
        setModalAbierto(true);
    };

    const elegir = (nombre) => {
        if (destino?.tipo === 'base') {
            setBaseElegida(nombre);
        }
        else if (destino?.tipo === 'slot') {
            setSlots(comparadas.map((nombreActual, indice) => (indice === destino.indice ? nombre : nombreActual)));
        }
        else if (destino?.tipo === 'nueva') {
            setSlots([...comparadas.filter(Boolean), nombre].slice(0, MAX_COMPARADAS));
        }
        setModalAbierto(false);
    };

    // En el modal se ocultan las secretarías ya puestas en otra tarjeta.
    const yaPuestas = useMemo(() => new Set([
        ...mias.map((fila) => normalizar(fila.secretaria)),
        ...comparadas.filter(Boolean).map((nombre) => normalizar(nombre)),
    ]), [mias, comparadas]);
    const candidatasModal = candidatas.filter((fila) => !yaPuestas.has(normalizar(fila.secretaria)));

    if (error) {
        return (
            <Card className="celda-col-completa">
                <CardHeader title="Comparativa de secretarías" subtitle="Proceso de cobro de una secretaría frente a otra." />
                <EmptyState icon={Scale} title="No se pudo cargar la comparativa" description="Revisa la conexión y vuelve a intentarlo." />
                {onReintentar ? (
                    <div className="filtro-fila">
                        <button type="button" className="btn btn-secundario" onClick={onReintentar}>Reintentar</button>
                    </div>
                ) : null}
            </Card>
        );
    }

    if (cargando) {
        return (
            <Card className="celda-col-completa">
                <CardHeader title="Comparativa de secretarías" subtitle="Proceso de cobro de una secretaría frente a otra." />
                <div className="comparativa-par">
                    <div className="comparativa-tarjeta comparativa-tarjeta-vacia" />
                    <div className="comparativa-tarjeta comparativa-tarjeta-vacia" />
                </div>
            </Card>
        );
    }

    if (filas.length === 0) {
        return (
            <Card className="celda-col-completa">
                <CardHeader title="Comparativa de secretarías" subtitle="Proceso de cobro de una secretaría frente a otra." />
                <EmptyState icon={Users} title="Sin secretarías en este filtro" description="Ajusta el período o el alcance de cuentas de la barra superior para ver la comparativa." />
            </Card>
        );
    }

    return (
        <Card className="celda-col-completa">
            <CardHeader
                title="Comparativa de secretarías"
                subtitle={mias.length > 0
                    ? 'Tu secretaría frente a una o dos que eliges, con el mismo período y alcance de la barra superior. Solo datos agregados.'
                    : 'Una secretaría frente a una o dos que eliges, con el mismo período y alcance de la barra superior. Solo datos agregados.'}
                action={<Badge tone="info"><Scale />Comparación</Badge>}
            />
            <div className="comparativa-par">
                {mias.length > 0
                    ? mias.map((fila) => (
                        <TarjetaSecretaria key={fila.secretaria} datos={fila} titulo="Mi secretaría" />
                    ))
                    : (
                        <TarjetaSecretaria
                            datos={base}
                            titulo="Secretaría de referencia"
                            onCambiar={() => abrirModal({ tipo: 'base' })}
                        />
                    )}

                {comparadas.map((nombre, indice) => (
                    <TarjetaSecretaria
                        key={`comparada-${indice}`}
                        datos={nombre ? (porNombre.get(nombre) ?? null) : null}
                        titulo={indice === 0 ? 'Secretaría comparada' : 'Segunda comparación'}
                        onCambiar={() => abrirModal({ tipo: 'slot', indice })}
                    />
                ))}

                {comparadas.length < MAX_COMPARADAS ? (
                    <div className="comparativa-tarjeta comparativa-tarjeta-vacia">
                        <p className="comparativa-tarjeta-titulo">Otra comparación</p>
                        <button type="button" className="btn btn-secundario" onClick={() => abrirModal({ tipo: 'nueva' })}>
                            <Plus />
                            Añadir secretaría
                        </button>
                    </div>
                ) : null}
            </div>

            {modalAbierto ? (
                <Modal
                    title="Elegir secretaría"
                    subtitle={destino?.tipo === 'base'
                        ? 'Elige la secretaría de referencia de la comparativa.'
                        : 'Elige la secretaría que quieres poner en comparación.'}
                    onClose={() => setModalAbierto(false)}
                >
                    <label className="campo-filtro">
                        <span className="field-label-corto">Buscar secretaría</span>
                        <span className="busqueda-listado">
                            <Search className="input-icono" />
                            <input
                                className="input input-con-icono"
                                value={busqueda}
                                onChange={(event) => setBusqueda(event.target.value)}
                                placeholder="Nombre de la secretaría"
                                aria-label="Buscar secretaría para comparar"
                            />
                        </span>
                    </label>
                    <ul className="comparativa-lista">
                        {candidatasModal.map((fila) => (
                            <li key={fila.secretaria}>
                                <button
                                    type="button"
                                    className="comparativa-opcion"
                                    onClick={() => elegir(fila.secretaria)}
                                >
                                    <span className="comparativa-opcion-nombre">{fila.secretaria}</span>
                                    <span className="comparativa-opcion-cifras">
                                        {formatNumber(fila.contratos ?? 0)} contratos · {formatPercent(fila.cobertura ?? 0, 1)} de cobertura
                                    </span>
                                </button>
                            </li>
                        ))}
                        {candidatasModal.length === 0 ? (
                            <li className="comparativa-lista-vacia">Ninguna secretaría coincide con la búsqueda.</li>
                        ) : null}
                    </ul>
                </Modal>
            ) : null}
        </Card>
    );
}
