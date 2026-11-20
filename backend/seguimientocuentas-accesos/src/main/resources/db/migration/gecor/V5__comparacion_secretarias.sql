-- Comparativa entre secretarias dentro de la analitica: dos secretarias lado a lado con el
-- proceso de cobro de cada una. Solo datos agregados, nunca el detalle de un contrato.

INSERT INTO permiso (codigo, modulo_id, nombre)
SELECT 'CONTRATOS_COMPARAR_SECRETARIAS', m.id, 'Comparar una secretaria contra otra en la analitica'
FROM modulo m
WHERE m.codigo = 'ANALITICA'
ON CONFLICT (codigo) DO NOTHING;

-- Se concede a todo rol que ya puede ver contratos: la comparativa es de datos agregados.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM rol r
JOIN permiso p ON p.codigo = 'CONTRATOS_COMPARAR_SECRETARIAS'
WHERE r.codigo IN ('ADMIN', 'ENLACE', 'BASICO', 'AUDITOR')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
