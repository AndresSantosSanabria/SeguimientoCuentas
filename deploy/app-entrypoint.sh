#!/bin/sh
set -e

# ============================================================
# 1) /config.js -> configuracion de la SPA en runtime
# ============================================================
# Genera /config.js a partir de las variables de entorno del contenedor.
# Asi la misma imagen sirve cualquier entorno (dev, QA, prod) sin reconstruir y
# sin quemar URLs de localhost dentro del bundle. env.js lo lee como
# window.__APP_CONFIG__.
CONFIG_FILE="/usr/share/nginx/html/config.js"

cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = {
  API_URL: "${VITE_API_URL:-}",
  ENABLE_AUTH: "${VITE_ENABLE_AUTH:-true}",
  KEYCLOAK_BASE_URL: "${VITE_KEYCLOAK_BASE_URL:-}",
  KEYCLOAK_REALM: "${VITE_KEYCLOAK_REALM:-}",
  KEYCLOAK_CLIENT_ID: "${VITE_KEYCLOAK_CLIENT_ID:-}",
  KEYCLOAK_REDIRECT_URI: "${VITE_KEYCLOAK_REDIRECT_URI:-}",
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: "${VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI:-}",
  KEYCLOAK_RESPONSE_TYPE: "${VITE_KEYCLOAK_RESPONSE_TYPE:-code}",
  KEYCLOAK_SCOPE: "${VITE_KEYCLOAK_SCOPE:-openid profile email}"
};
EOF

# ============================================================
# 2) /oidc/token -> proxy same-origin hacia el endpoint de token
# ============================================================
# El realm exige que el Origin del POST sea LITERALMENTE el valor configurado
# en "Web origins" del client (por eso "http://localhost:3000/*" no coincide con
# el "http://localhost:3000" que manda el navegador). En vez de depender de esa
# configuracion, el intercambio codigo->token viaja por nuestro mismo origen y
# nginx lo reenvia a Keycloak SIN cabecera Origin: es una peticion
# servidor-a-servidor y no esta sujeta a esa regla.
PROXY_FILE="/etc/nginx/oidc-proxy.conf"

if [ -n "${KEYCLOAK_ISSUER_URI:-}" ]; then
    ISSUER="${KEYCLOAK_ISSUER_URI%/}"
    OIDC_HOST=$(printf '%s' "$ISSUER" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:]+).*#\1#')
    cat > "$PROXY_FILE" <<EOF
location = /oidc/token {
    proxy_pass ${ISSUER}/protocol/openid-connect/token;
    proxy_set_header Host ${OIDC_HOST};
    proxy_set_header Origin "";
    proxy_set_header Referer "";
    proxy_ssl_server_name on;
    proxy_http_version 1.1;
}
EOF
    echo "[keycloak] oidc-proxy: /oidc/token -> ${ISSUER}/protocol/openid-connect/token"
else
    printf '%s\n' \
        'location = /oidc/token {' \
        '    return 503 '"'"'{"error":"oidc_no_configurado","message":"Falta KEYCLOAK_ISSUER_URI en el entorno del frontend."}'"'"';' \
        '}' > "$PROXY_FILE"
    echo "[keycloak] oidc-proxy: desactivado (sin KEYCLOAK_ISSUER_URI)"
fi

echo "[keycloak] config.js generado: auth=${VITE_ENABLE_AUTH:-true} realm=${VITE_KEYCLOAK_REALM:-<vacío>} client=${VITE_KEYCLOAK_CLIENT_ID:-<vacío>}"
