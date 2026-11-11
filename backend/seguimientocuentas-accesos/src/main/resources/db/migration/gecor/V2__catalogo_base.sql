-- Catalogo base de la aplicacion: modulos, permisos y roles con sus permisos.
--
-- Se siembra una sola vez. Lo que un administrador quite despues no se vuelve a poner:
-- para eso estan las migraciones siguientes, no este archivo.
--
-- El catalogo de secretarias NO se siembra aqui: sale de las dependencias reales de los
-- contratos en supervisa y lo sincroniza la aplicacion al arrancar.

INSERT INTO modulo (codigo, nombre) VALUES
    ('CONTRATOS',   'Contratos'),
    ('ANALITICA',   'Analitica'),
    ('TIEMPO_REAL', 'Tiempo real'),
    ('ACCESOS',     'Accesos');

INSERT INTO permiso (codigo, modulo_id, nombre)
SELECT v.codigo, m.id, v.nombre
FROM (VALUES
    ('CONTRATOS_VER',          'CONTRATOS',   'Ver la lista de contratos'),
    ('CONTRATOS_VER_TODOS',    'CONTRATOS',   'Ver los contratos de todas las secretarias'),
    ('CONTRATOS_VER_DETALLE',  'CONTRATOS',   'Ver el detalle y el progreso de un contrato'),
    ('CONTRATOS_EXPORTAR',     'CONTRATOS',   'Exportar a Excel'),
    ('ANALITICA_VER',          'ANALITICA',   'Ver la pantalla de analitica'),
    ('TIEMPO_REAL_VER',        'TIEMPO_REAL', 'Ver los cambios en vivo'),
    ('SECRETARIAS_GESTIONAR',  'ACCESOS',     'Administrar secretarias y asignaciones')
) AS v(codigo, modulo, nombre)
JOIN modulo m ON m.codigo = v.modulo;

INSERT INTO rol (codigo, nombre, ambito) VALUES
    ('ADMIN',      'Administrador', 'GLOBAL'),
    ('DIRECTOR',   'Director',      'GLOBAL'),
    ('SUPERVISOR', 'Supervisor',    'SECRETARIA'),
    ('CONSULTOR',  'Consultor',     'SECRETARIA');

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r
JOIN permiso p ON p.codigo = ANY (CASE r.codigo
    WHEN 'ADMIN' THEN ARRAY[
        'CONTRATOS_VER', 'CONTRATOS_VER_TODOS', 'CONTRATOS_VER_DETALLE', 'CONTRATOS_EXPORTAR',
        'ANALITICA_VER', 'TIEMPO_REAL_VER', 'SECRETARIAS_GESTIONAR']
    WHEN 'DIRECTOR' THEN ARRAY[
        'CONTRATOS_VER', 'CONTRATOS_VER_TODOS', 'CONTRATOS_VER_DETALLE', 'CONTRATOS_EXPORTAR',
        'ANALITICA_VER', 'TIEMPO_REAL_VER']
    WHEN 'SUPERVISOR' THEN ARRAY[
        'CONTRATOS_VER', 'CONTRATOS_VER_DETALLE', 'CONTRATOS_EXPORTAR',
        'ANALITICA_VER', 'TIEMPO_REAL_VER']
    ELSE ARRAY['CONTRATOS_VER', 'CONTRATOS_VER_DETALLE']
END);