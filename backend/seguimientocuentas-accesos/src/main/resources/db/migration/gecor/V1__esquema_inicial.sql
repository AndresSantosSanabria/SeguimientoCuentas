-- Esquema de accesos de GE-COR: usuarios, roles, permisos granulares y secretarias.
--
-- Cada catalogo tiene su id propio y su codigo natural unico; todas las relaciones apuntan al id.
-- Nada derivado se guarda: el ultimo ingreso se calcula en la vista v_usuario.

CREATE TABLE modulo (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          varchar(40)  NOT NULL UNIQUE,
    nombre          varchar(120) NOT NULL,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_modulo_codigo CHECK (codigo = upper(codigo) AND btrim(codigo) <> '')
);

CREATE TABLE secretaria (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          varchar(80)  NOT NULL UNIQUE,
    nombre          varchar(160) NOT NULL,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_secretaria_codigo CHECK (codigo = upper(codigo) AND btrim(codigo) <> ''),
    CONSTRAINT ck_secretaria_nombre CHECK (btrim(nombre) <> '')
);

CREATE TABLE rol (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          varchar(60)  NOT NULL UNIQUE,
    nombre          varchar(120) NOT NULL,
    ambito          varchar(20)  NOT NULL DEFAULT 'GLOBAL',
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_rol_codigo CHECK (codigo = upper(codigo) AND btrim(codigo) <> ''),
    CONSTRAINT ck_rol_ambito CHECK (ambito IN ('GLOBAL', 'SECRETARIA'))
);

CREATE TABLE permiso (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          varchar(80)  NOT NULL UNIQUE,
    modulo_id       integer      NOT NULL REFERENCES modulo (id) ON DELETE RESTRICT,
    nombre          varchar(160) NOT NULL,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_permiso_codigo CHECK (codigo = upper(codigo) AND btrim(codigo) <> '')
);

-- La identidad la pone Keycloak: el sub del token es la clave, no un id inventado aqui.
CREATE TABLE usuario (
    keycloak_id     varchar(80)  PRIMARY KEY,
    nombre          varchar(160) NOT NULL,
    correo          varchar(160),
    rol_id          integer      REFERENCES rol (id) ON DELETE SET NULL,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuario_keycloak CHECK (btrim(keycloak_id) <> ''),
    CONSTRAINT ck_usuario_nombre CHECK (btrim(nombre) <> '')
);

CREATE TABLE rol_permiso (
    rol_id      integer NOT NULL REFERENCES rol (id) ON DELETE CASCADE,
    permiso_id  integer NOT NULL REFERENCES permiso (id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE rol_secretaria (
    rol_id         integer NOT NULL REFERENCES rol (id) ON DELETE CASCADE,
    secretaria_id  integer NOT NULL REFERENCES secretaria (id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, secretaria_id)
);

CREATE TABLE usuario_permiso (
    keycloak_id  varchar(80) NOT NULL REFERENCES usuario (keycloak_id) ON DELETE CASCADE,
    permiso_id   integer     NOT NULL REFERENCES permiso (id) ON DELETE CASCADE,
    permitir     boolean     NOT NULL DEFAULT true,
    PRIMARY KEY (keycloak_id, permiso_id)
);

CREATE TABLE usuario_secretaria (
    keycloak_id    varchar(80) NOT NULL REFERENCES usuario (keycloak_id) ON DELETE CASCADE,
    secretaria_id  integer     NOT NULL REFERENCES secretaria (id) ON DELETE CASCADE,
    PRIMARY KEY (keycloak_id, secretaria_id)
);

CREATE TABLE ingreso (
    id           bigserial PRIMARY KEY,
    keycloak_id  varchar(80) NOT NULL REFERENCES usuario (keycloak_id) ON DELETE CASCADE,
    origen       varchar(20) NOT NULL DEFAULT 'web',
    fecha        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_ingreso_origen CHECK (origen IN ('web', 'ws', 'api'))
);

-- Postgres no indexa las claves foraneas: sin estos indices, borrar un catalogo barre la tabla entera.
CREATE INDEX idx_permiso_modulo ON permiso (modulo_id);
CREATE INDEX idx_usuario_rol ON usuario (rol_id);
CREATE INDEX idx_rol_permiso_permiso ON rol_permiso (permiso_id);
CREATE INDEX idx_rol_secretaria_secretaria ON rol_secretaria (secretaria_id);
CREATE INDEX idx_usuario_permiso_permiso ON usuario_permiso (permiso_id);
CREATE INDEX idx_usuario_secretaria_secretaria ON usuario_secretaria (secretaria_id);
CREATE INDEX idx_ingreso_usuario_fecha ON ingreso (keycloak_id, fecha DESC);

-- actualizado_en lo mantiene la base, no el codigo: nadie puede olvidarse de ponerlo.
CREATE FUNCTION marcar_actualizado() RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_modulo_actualizado     BEFORE UPDATE ON modulo     FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER tg_secretaria_actualizado BEFORE UPDATE ON secretaria FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER tg_rol_actualizado        BEFORE UPDATE ON rol        FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER tg_permiso_actualizado    BEFORE UPDATE ON permiso    FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();
CREATE TRIGGER tg_usuario_actualizado    BEFORE UPDATE ON usuario    FOR EACH ROW EXECUTE FUNCTION marcar_actualizado();

-- El ultimo ingreso es un dato derivado: se calcula, no se guarda.
CREATE VIEW v_usuario AS
SELECT u.keycloak_id,
       u.nombre,
       u.correo,
       u.activo,
       u.creado_en,
       u.actualizado_en,
       r.id     AS rol_id,
       r.codigo AS rol_codigo,
       r.nombre AS rol_nombre,
       (SELECT max(i.fecha) FROM ingreso i WHERE i.keycloak_id = u.keycloak_id) AS ultimo_ingreso
FROM usuario u
LEFT JOIN rol r ON r.id = u.rol_id;