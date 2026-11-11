import { KeyRound, ShieldCheck, UserCog, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeletons';
import {
    useCambiarRol,
    useDefinirModulo,
    useDefinirPermiso,
    usePermisosAcceso,
    useRolesAcceso,
    useUsuariosAcceso,
} from '@/hooks/useAccesos';
import { formatDateTime } from '@/lib/format';

const TABS = [
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'roles', label: 'Roles', icon: ShieldCheck },
    { id: 'permisos', label: 'Permisos', icon: KeyRound },
];

const OPCIONES_PERMISO = [
    { valor: 'heredar', etiqueta: 'Heredar del rol' },
    { valor: 'permitir', etiqueta: 'Permitir' },
    { valor: 'denegar', etiqueta: 'Denegar' },
];

function valorTri(estado) {
    if (estado === true) return 'permitir';
    if (estado === false) return 'denegar';
    return 'heredar';
}

function estadoDePermiso(directo, porRol) {
    if (directo === true) return { texto: 'Concedido', tono: 'success' };
    if (directo === false) return { texto: 'Denegado', tono: 'danger' };
    if (porRol) return { texto: 'Por rol', tono: 'info' };
    return { texto: 'Sin permiso', tono: 'neutral' };
}

function agruparPorModulo(permisos) {
    const grupos = new Map();
    for (const permiso of permisos ?? []) {
        const clave = permiso.moduloNombre ?? permiso.modulo ?? 'General';
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(permiso);
    }
    return [...grupos.entries()];
}

function Cargando({ titulo, subtitulo }) {
    return (
        <Card>
            <CardHeader title={titulo} subtitle={subtitulo} />
            <TableSkeleton rows={6} />
        </Card>
    );
}

function Fallo({ onRetry }) {
    return (
        <Card>
            <ErrorState
                title="No fue posible cargar la configuración de accesos"
                message="El backend no respondió con los usuarios, roles y permisos."
                onRetry={onRetry}
            />
        </Card>
    );
}

export function ConfiguracionPage() {
    const [tab, setTab] = useState('usuarios');
    const [seleccionado, setSeleccionado] = useState(null);

    return (
        <div className="pila-pagina">
            <PageHeader
                eyebrow="Accesos"
                title="Configuración"
                description="Quién entra, qué rol tiene y qué puede usar. Los permisos granulares se aplican sobre la persona, sin importar su rol."
            />

            <div className="config-tabs" role="tablist" aria-label="Secciones de configuración">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className="config-tab"
                        onClick={() => setTab(id)}
                    >
                        <Icon />
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'usuarios' ? (
                <Usuarios seleccionado={seleccionado} onSeleccionar={setSeleccionado} />
            ) : null}
            {tab === 'roles' ? <Roles /> : null}
            {tab === 'permisos' ? <Permisos /> : null}
        </div>
    );
}

function Usuarios({ seleccionado, onSeleccionar }) {
    const { data: usuarios, isLoading, isError, refetch } = useUsuariosAcceso();
    const { data: roles } = useRolesAcceso();
    const { data: permisos } = usePermisosAcceso();
    const cambiarRol = useCambiarRol();

    const usuario = useMemo(
        () => (usuarios ?? []).find((item) => item.keycloakId === seleccionado) ?? null,
        [usuarios, seleccionado],
    );

    if (isLoading) {
        return <Cargando titulo="Usuarios" subtitulo="Cargando usuarios registrados en GECOR." />;
    }
    if (isError) {
        return <Fallo onRetry={() => refetch()} />;
    }
    if (!usuarios || usuarios.length === 0) {
        return (
            <Card>
                <EmptyState
                    icon={UserCog}
                    title="Todavía no hay usuarios registrados"
                    description="Cada persona aparece aquí en su primer ingreso a la plataforma."
                />
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader
                    title="Usuarios"
                    subtitle="Asigna un rol base y ajusta permisos puntuales por persona."
                    action={<Badge tone="info">{usuarios.length}</Badge>}
                />
                <div className="tabla-envuelta">
                    <table className="tabla-listado">
                        <thead>
                            <tr>
                                <th className="table-th">Usuario</th>
                                <th className="table-th">Rol</th>
                                <th className="table-th table-th-centro">Permisos propios</th>
                                <th className="table-th">Último ingreso</th>
                                <th className="table-th table-th-flecha" aria-label="Abrir" />
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map((item) => {
                                const excepciones = Object.keys(item.permisosDirectos ?? {}).length;
                                return (
                                    <tr
                                        key={item.keycloakId}
                                        className="table-row"
                                        onClick={() => onSeleccionar(item.keycloakId)}
                                    >
                                        <td className="table-td celda-titulo">
                                            <span className="config-usuario">
                                                <span className="config-usuario-nombre">{item.nombre}</span>
                                                <span className="config-usuario-correo">{item.correo || 'Sin correo'}</span>
                                            </span>
                                        </td>
                                        <td className="table-td" onClick={(event) => event.stopPropagation()}>
                                            <select
                                                className="input input-corto"
                                                value={item.rolCodigo ?? ''}
                                                disabled={cambiarRol.isPending}
                                                aria-label={`Rol de ${item.nombre}`}
                                                onChange={(event) =>
                                                    cambiarRol.mutate({
                                                        keycloakId: item.keycloakId,
                                                        rolCodigo: event.target.value || null,
                                                    })}
                                            >
                                                <option value="">Sin rol</option>
                                                {(roles ?? []).map((rol) => (
                                                    <option key={rol.codigo} value={rol.codigo}>
                                                        {rol.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="table-td table-td-centro">
                                            {excepciones > 0
                                                ? <Badge tone="warning">{excepciones}</Badge>
                                                : <span className="config-tenue">—</span>}
                                        </td>
                                        <td className="table-td config-tenue">
                                            {item.ultimoIngreso ? formatDateTime(item.ultimoIngreso) : 'Sin ingresos'}
                                        </td>
                                        <td className="table-td table-td-derecha">
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onSeleccionar(item.keycloakId);
                                                }}
                                            >
                                                Permisos
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {usuario ? (
                <PermisosUsuario
                    usuario={usuario}
                    roles={roles ?? []}
                    permisos={permisos ?? []}
                    onCerrar={() => onSeleccionar(null)}
                />
            ) : null}
        </>
    );
}

function PermisosUsuario({ usuario, roles, permisos, onCerrar }) {
    const definir = useDefinirPermiso();
    const rol = roles.find((item) => item.codigo === usuario.rolCodigo) ?? null;
    const delRol = new Set(rol?.permisos ?? []);
    const grupos = agruparPorModulo(permisos);

    return (
        <Card>
            <CardHeader
                title={`Permisos de ${usuario.nombre}`}
                subtitle={`${rol?.nombre ?? 'Sin rol'} · los cambios se aplican de inmediato`}
                action={(
                    <button type="button" className="btn btn-ghost" onClick={onCerrar}>
                        Cerrar
                    </button>
                )}
            />

            {permisos.length === 0 ? (
                <EmptyState icon={KeyRound} title="Sin permisos en el catálogo" />
            ) : (
                grupos.map(([modulo, lista]) => (
                    <div key={modulo} className="config-grupo">
                        <p className="micro-label micro-label-encabezado">{modulo}</p>
                        <div className="tabla-envuelta">
                            <table className="tabla-interna">
                                <tbody>
                                    {lista.map((permiso) => {
                                        const directo = usuario.permisosDirectos?.[permiso.codigo];
                                        const porRol = delRol.has(permiso.codigo);
                                        const efectivo = directo === undefined ? porRol : directo;
                                        const estado = estadoDePermiso(directo, porRol);
                                        return (
                                            <tr key={permiso.codigo} className="config-permiso-fila">
                                                <td className="table-td">
                                                    <span className="config-usuario">
                                                        <span className="config-usuario-nombre">{permiso.nombre}</span>
                                                        <span className="config-permiso-codigo">{permiso.codigo}</span>
                                                    </span>
                                                </td>
                                                <td className="table-td table-td-centro">
                                                    <Badge tone={estado.tono} dot={efectivo}>
                                                        {estado.texto}
                                                    </Badge>
                                                </td>
                                                <td className="table-td table-td-derecha">
                                                    <select
                                                        className="input input-corto"
                                                        value={valorTri(directo)}
                                                        disabled={definir.isPending}
                                                        aria-label={`Permiso ${permiso.nombre} para ${usuario.nombre}`}
                                                        onChange={(event) => definir.mutate({
                                                            keycloakId: usuario.keycloakId,
                                                            codigo: permiso.codigo,
                                                            permitir: event.target.value === 'permitir'
                                                                ? true
                                                                : event.target.value === 'denegar'
                                                                    ? false
                                                                    : null,
                                                        })}
                                                    >
                                                        {OPCIONES_PERMISO.map((opcion) => (
                                                            <option key={opcion.valor} value={opcion.valor}>
                                                                {opcion.etiqueta}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </Card>
    );
}

function Roles() {
    const { data: roles, isLoading, isError, refetch } = useRolesAcceso();

    if (isLoading) {
        return <Cargando titulo="Roles" subtitulo="Cargando el catálogo de roles." />;
    }
    if (isError) {
        return <Fallo onRetry={() => refetch()} />;
    }
    if (!roles || roles.length === 0) {
        return (
            <Card>
                <EmptyState icon={ShieldCheck} title="Sin roles en el catálogo" />
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader
                title="Roles"
                subtitle="Cada rol define los permisos base que hereda una persona."
                action={<Badge tone="info">{roles.length}</Badge>}
            />
            <div className="tabla-envuelta">
                <table className="tabla-listado">
                    <thead>
                        <tr>
                            <th className="table-th">Rol</th>
                            <th className="table-th">Ámbito</th>
                            <th className="table-th table-th-centro">Usuarios</th>
                            <th className="table-th">Permisos del rol</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map((rol) => (
                            <tr key={rol.codigo} className="table-row">
                                <td className="table-td celda-titulo">
                                    <span className="config-usuario">
                                        <span className="config-usuario-nombre">{rol.nombre}</span>
                                        <span className="config-permiso-codigo">{rol.codigo}</span>
                                    </span>
                                </td>
                                <td className="table-td">
                                    <Badge tone={rol.ambito === 'GLOBAL' ? 'info' : 'neutral'}>
                                        {rol.ambito === 'GLOBAL' ? 'Global' : 'Por secretaría'}
                                    </Badge>
                                </td>
                                <td className="table-td table-td-centro">{rol.usuarios}</td>
                                <td className="table-td">
                                    <span className="config-badges">
                                        {(rol.permisos ?? []).map((codigo) => (
                                            <Badge key={codigo} tone="neutral">{codigo}</Badge>
                                        ))}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function Permisos() {
    const { data: permisos, isLoading, isError, refetch } = usePermisosAcceso();
    const definirModulo = useDefinirModulo();

    if (isLoading) {
        return <Cargando titulo="Permisos" subtitulo="Cargando el catálogo de permisos." />;
    }
    if (isError) {
        return <Fallo onRetry={() => refetch()} />;
    }
    if (!permisos || permisos.length === 0) {
        return (
            <Card>
                <EmptyState icon={KeyRound} title="Sin permisos en el catálogo" />
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader
                title="Permisos"
                subtitle="Catálogo de acciones que se pueden conceder o denegar por persona."
                action={<Badge tone="info">{permisos.length}</Badge>}
            />
            {agruparPorModulo(permisos).map(([modulo, lista]) => (
                <div key={modulo} className="config-grupo">
                    <div className="config-grupo-encabezado">
                        <p className="micro-label micro-label-encabezado">{modulo}</p>
                        <label className="config-habilitador-vista">
                            <input
                                type="checkbox"
                                checked={lista[0]?.moduloActivo === true}
                                disabled={definirModulo.isPending}
                                onChange={(event) => definirModulo.mutate({
                                    codigo: lista[0]?.modulo,
                                    activo: event.target.checked,
                                })}
                            />
                            Vista habilitada
                        </label>
                    </div>
                    <div className="tabla-envuelta">
                        <table className="tabla-interna">
                            <thead>
                                <tr>
                                    <th className="table-th table-th-compacta">Permiso</th>
                                    <th className="table-th table-th-compacta">Código</th>
                                    <th className="table-th table-th-compacta table-th-derecha">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lista.map((permiso) => (
                                    <tr key={permiso.codigo}>
                                        <td className="table-td table-td-compacta">{permiso.nombre}</td>
                                        <td className="table-td table-td-compacta config-permiso-codigo">
                                            {permiso.codigo}
                                        </td>
                                        <td className="table-td table-td-compacta table-td-derecha">
                                            <Badge tone={permiso.activo ? 'success' : 'neutral'} dot={permiso.activo}>
                                                {permiso.activo ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </Card>
    );
}
