#!/bin/sh
# Repone la ruta del host de Docker hacia el Keycloak corporativo.
#
# Problema: si alguna red bridge de Docker usa la subred 172.20.0.0/16 (la
# misma que usa la red corporativa donde vive el Keycloak), el host de Docker
# enruta el trafico hacia esa IP por ese bridge y los contenedores se quedan
# sin salida. El navegador recibe 499 y el login nunca termina.
#
# La ruta /16 del bridge gana sobre la ruta por defecto. Se resuelve con una
# ruta /32 mas especifica hacia el gateway real.
#
# La ruta vive en el netns del host de Docker, asi que hay que reaplicarla
# cada vez que Docker reinicia: este servicio queda vigilando y la revisa.
set -u

TARGET="${ROUTE_TARGET:-}"
PREFIX="${ROUTE_TARGET_PREFIX:-32}"
INTERVAL="${ROUTE_CHECK_INTERVAL:-30}"

log() { echo "[route-fixer] $*"; }

# Acepta un host suelto o una URL completa (https://host/realms/...).
host_objetivo() {
  echo "$TARGET" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|/.*$||' -e 's|:.*$||'
}

resolver_ip() {
  getent hosts "$(host_objetivo)" 2>/dev/null | awk '{print $1; exit}'
}

gateway() {
  ip route show default 2>/dev/null | awk '/default/ {print $3; exit}'
}

asegurar_ruta() {
  ip_destino=$(resolver_ip)
  if [ -z "$ip_destino" ]; then
    log "no se pudo resolver $(host_objetivo) (se reintenta)"
    return 1
  fi

  gw=$(gateway)
  if [ -z "$gw" ]; then
    log "el host de Docker no tiene ruta por defecto"
    return 1
  fi

  if ip route get "$ip_destino" 2>/dev/null | head -n 1 | grep -q "via $gw"; then
    return 0
  fi

  if ip route replace "$ip_destino/$PREFIX" via "$gw" 2>/dev/null; then
    log "ruta restablecida: $ip_destino/$PREFIX via $gw"
    return 0
  fi

  log "no se pudo crear la ruta hacia $ip_destino"
  return 1
}

while true; do
  asegurar_ruta
  sleep "$INTERVAL"
done
