-- Los cuatro perfiles funcionales. Solo modifica GECOR, nunca la base SupervisA.
UPDATE gecor.rol SET codigo = 'ENLACE', nombre = 'Enlace', ambito = 'SECRETARIA' WHERE codigo = 'DIRECTOR';
UPDATE gecor.rol SET codigo = 'BASICO', nombre = 'Básico', ambito = 'GLOBAL' WHERE codigo = 'SUPERVISOR';
UPDATE gecor.rol SET codigo = 'AUDITOR', nombre = 'Auditor', ambito = 'GLOBAL' WHERE codigo = 'CONSULTOR';

INSERT INTO gecor.rol (codigo, nombre, ambito)
VALUES ('BASICO', 'Básico', 'GLOBAL') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO gecor.rol (codigo, nombre, ambito)
VALUES ('ENLACE', 'Enlace', 'SECRETARIA') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO gecor.rol (codigo, nombre, ambito)
VALUES ('AUDITOR', 'Auditor', 'GLOBAL') ON CONFLICT (codigo) DO NOTHING;

-- Reconstruye las concesiones iniciales. Las excepciones por usuario siguen viviendo
-- en usuario_permiso y prevalecen sobre los permisos heredados del rol.
DELETE FROM gecor.rol_permiso rp USING gecor.rol r
WHERE rp.rol_id = r.id AND r.codigo IN ('ADMIN', 'ENLACE', 'BASICO', 'AUDITOR');

INSERT INTO gecor.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM gecor.rol r
JOIN gecor.permiso p ON p.codigo = ANY (CASE r.codigo
    WHEN 'ADMIN' THEN ARRAY[
        'CONTRATOS_VER', 'CONTRATOS_VER_TODOS', 'CONTRATOS_VER_DETALLE', 'CONTRATOS_EXPORTAR',
        'ANALITICA_VER', 'TIEMPO_REAL_VER', 'SECRETARIAS_GESTIONAR', 'USUARIOS_ADMINISTRAR']
    WHEN 'ENLACE' THEN ARRAY[
        'CONTRATOS_VER', 'CONTRATOS_VER_DETALLE', 'CONTRATOS_EXPORTAR',
        'ANALITICA_VER', 'TIEMPO_REAL_VER']
    WHEN 'BASICO' THEN ARRAY['CONTRATOS_VER', 'CONTRATOS_VER_DETALLE']
    ELSE ARRAY['CONTRATOS_VER', 'CONTRATOS_VER_DETALLE', 'ANALITICA_VER']
END);

-- El catálogo actual usa módulos como habilitadores generales por vista:
-- desactivar un módulo retira en cadena todos sus permisos efectivos.
