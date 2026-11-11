package com.sgcc.seguimientocuentas.accesos.application;

import java.util.Set;

/** Resuelve dependencias desde el sistema fuente sin acoplar accesos a un adaptador concreto. */
public interface SecretariasUsuarioResolver {
    Set<String> secretariasPorCorreo(String correo);
}
