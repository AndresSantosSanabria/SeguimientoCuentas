-- El supervisor ve unicamente los contratos que tiene asignados a su supervision y, dentro de
-- cada uno, el detalle de la cuenta de cobro seleccionada. No alcanza ni la analitica ni el
-- tiempo real: su alcance son sus contratos.

INSERT INTO gecor.rol (codigo, nombre, ambito)
VALUES ('SUPERVISOR', 'Supervisor', 'SECRETARIA') ON CONFLICT (codigo) DO NOTHING;

INSERT INTO gecor.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM gecor.rol r
JOIN gecor.permiso p ON p.codigo = ANY (ARRAY['CONTRATOS_VER', 'CONTRATOS_VER_DETALLE'])
WHERE r.codigo = 'SUPERVISOR'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
