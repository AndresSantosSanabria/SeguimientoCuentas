import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    cambiarRolUsuario,
    definirPermisoUsuario,
    definirModuloAcceso,
    fetchPermisosAcceso,
    fetchRolesAcceso,
    fetchUsuariosAcceso,
} from '@/api/accesos';
import { queryKeys } from '@/api/queryKeys';

const COMUN = {
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
};

export function useUsuariosAcceso() {
    return useQuery({
        queryKey: queryKeys.accesos.usuarios,
        queryFn: fetchUsuariosAcceso,
        ...COMUN,
    });
}

export function useRolesAcceso() {
    return useQuery({
        queryKey: queryKeys.accesos.roles,
        queryFn: fetchRolesAcceso,
        ...COMUN,
    });
}

export function usePermisosAcceso() {
    return useQuery({
        queryKey: queryKeys.accesos.permisos,
        queryFn: fetchPermisosAcceso,
        ...COMUN,
    });
}

/**
 * Cualquier cambio de accesos invalida el listado y la sesion propia: si el
 * administrador se cambia sus propios permisos, el menu se actualiza sin recargar.
 */
function useMutacionAccesos(mutacion) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: mutacion,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accesos.usuarios });
            queryClient.invalidateQueries({ queryKey: queryKeys.accesos.roles });
            queryClient.invalidateQueries({ queryKey: queryKeys.accesos.permisos });
            queryClient.invalidateQueries({ queryKey: queryKeys.sesion });
        },
    });
}

export function useCambiarRol() {
    return useMutacionAccesos(({ keycloakId, rolCodigo }) => cambiarRolUsuario(keycloakId, rolCodigo));
}

export function useDefinirPermiso() {
    return useMutacionAccesos(({ keycloakId, codigo, permitir }) =>
        definirPermisoUsuario(keycloakId, codigo, permitir));
}

export function useDefinirModulo() {
    return useMutacionAccesos(({ codigo, activo }) => definirModuloAcceso(codigo, activo));
}
