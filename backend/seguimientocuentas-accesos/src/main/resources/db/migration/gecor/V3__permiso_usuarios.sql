-- Permiso para administrar usuarios, roles y permisos desde la pantalla de configuracion.
-- Se concede al rol ADMIN: los permisos granulares de cada persona se manejan en la
-- tabla usuario_permiso y no cambian este catalogo.

INSERT INTO permiso (codigo, modulo_id, nombre)
SELECT 'USUARIOS_ADMINISTRAR', m.id, 'Administrar usuarios, roles y permisos'
FROM modulo m
WHERE m.codigo = 'ACCESOS'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r
JOIN permiso p ON p.codigo = 'USUARIOS_ADMINISTRAR'
WHERE r.codigo = 'ADMIN'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- El ADMIN ya existente tambien administra secretarias.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r
JOIN permiso p ON p.codigo = 'SECRETARIAS_GESTIONAR'
WHERE r.codigo = 'ADMIN'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
