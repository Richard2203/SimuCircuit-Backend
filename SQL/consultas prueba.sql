-- === Join implicito de los componentes con sus respectivas resistencias ===
-- SELECT componente.id, componente.nombre, resistencia.banda_uno, resistencia.banda_dos, resistencia.banda_tres, componente.valor, resistencia.potencia_nominal FROM componente, resistencia WHERE componente.id = resistencia.componente_id LIMIT 100

-- === Join explicito de los componentes con sus respectivas resistencias para comprobar su consistencia y contenido ===
SELECT c.id, c.nombre, r.banda_uno, r.banda_dos, r.banda_tres, r.banda_tolerancia, c.valor, r.potencia_nominal FROM componente c INNER JOIN resistencia r ON c.id = r.componente_id LIMIT 100

SELECT c.id, c.nombre, r.banda_uno, r.banda_dos, r.banda_tres, r.banda_tolerancia, c.valor, r.potencia_nominal FROM componente c INNER JOIN resistencia r ON c.id = r.componente_id WHERE c.valor LIKE '4%' LIMIT 100

select * from componente;

select * from capacitor;

-- === Join explicito de los componentes con sus respectivos capacitores para comprobar su consistencia y contenido ===
SELECT c.id, c.nombre, cap.tipo_dioelectrico, cap.voltaje, c.valor, cap.polaridad FROM componente c INNER JOIN capacitor cap ON c.id = cap.componente_id LIMIT 100

SELECT c.id, c.nombre, cap.tipo_dioelectrico, cap.voltaje, c.valor, cap.polaridad FROM componente c INNER JOIN capacitor cap ON c.id = cap.componente_id WHERE c.valor LIKE '4.7u%'LIMIT 100

-- === Join explicito de los componentes con sus respectivas bobinas para comprobar su consistencia y contenido ===
SELECT c.id, c.nombre, b.corriente_max, b.resistencia_dc, c.valor FROM componente c INNER JOIN bobina b ON c.id = b.componente_id LIMIT 100

SELECT c.id, c.nombre, b.corriente_max, b.resistencia_dc, c.valor FROM componente c INNER JOIN bobina b ON c.id = b.componente_id WHERE c.valor LIKE '10%'LIMIT 100

-- === Join explicito de los componentes con sus respectivos diodos para comprobar su consistencia y contenido ===
SELECT c.id, c.nombre, d.tipo, d.corriente_max, d.voltaje_inv_max, d.caida_tension, c.valor FROM componente c INNER JOIN diodo d ON c.id = d.componente_id LIMIT 100

SELECT c.id, c.nombre, d.tipo, d.corriente_max, d.voltaje_inv_max, d.caida_tension, c.valor FROM componente c INNER JOIN diodo d ON c.id = d.componente_id WHERE c.valor LIKE '1N4%' LIMIT 100

SELECT c.id, c.nombre, d.tipo, d.corriente_max, d.voltaje_inv_max, d.caida_tension, c.valor FROM componente c INNER JOIN diodo d ON c.id = d.componente_id WHERE c.valor = 'AZUL' LIMIT 100


SELECT c.id, c.nombre, bjt.tipo, bjt.configuracion, bjt.beta, bjt.vbe_saturacion, bjt.vce_saturacion FROM componente c INNER JOIN transistor_bjt bjt ON c.id = bjt.componente_id LIMIT 100

SELECT c.id, c.nombre, bjt.tipo, bjt.configuracion, bjt.beta, bjt.vbe_saturacion, bjt.vce_saturacion FROM componente c INNER JOIN transistor_bjt bjt ON c.id = bjt.componente_id WHERE bjt.tipo = 'PNP' LIMIT 100

SELECT c.id, c.nombre, fet.tipo, fet.idss, fet.vp, fet.gm, fet.rd FROM componente c INNER JOIN transistor_fet fet ON c.id = fet.componente_id LIMIT 100

select * from regulador_voltaje;

SELECT ic.id AS 'instancia_id', ic.designador, ic.posicion_x, ic.posicion_y, ic.rotacion,
                   c.id AS 'componente_id', c.nombre, c.valor
            FROM instancia_componente ic
            INNER JOIN componente c ON ic.componente_id = c.id
            WHERE ic.circuito_id = 1;