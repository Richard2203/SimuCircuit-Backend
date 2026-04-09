use simucircuit_db;

-- === INSERCIÓN MASIVA DE BOBINAS E6 (ESTÁNDAR DE LABORATORIO) ===
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
('Bobina', 'Bobina de 10uH', '10u', 3, 3),
('Bobina', 'Bobina de 22uH', '22u', 3, 3),
('Bobina', 'Bobina de 33uH', '33u', 3, 3),
('Bobina', 'Bobina de 47uH', '47u', 3, 3),
('Bobina', 'Bobina de 100uH', '100u', 3, 3),
('Bobina', 'Bobina de 100uH', '100u', 3, 3),
('Bobina', 'Bobina de 220uH', '220u', 3, 3),
('Bobina', 'Bobina de 330uH', '330u', 3, 3),
('Bobina', 'Bobina de 470uH', '470u', 3, 3),
('Bobina', 'Bobina de 1000uH', '1000u', 3, 3),
('Bobina', 'Bobina de 10mH', '10m', 3, 3),
('Bobina', 'Bobina de 22mH', '22m', 3, 3),
('Bobina', 'Bobina de 33mH', '33m', 3, 3),
('Bobina', 'Bobina de 47mH', '47m', 3, 3),
('Bobina', 'Bobina de 100mH', '100m', 3, 3),
('Bobina', 'Bobina de 100mH', '100m', 3, 3),
('Bobina', 'Bobina de 220mH', '220m', 3, 3),
('Bobina', 'Bobina de 330mH', '330m', 3, 3),
('Bobina', 'Bobina de 470mH', '470m', 3, 3),
('Bobina', 'Bobina de 1000mH', '1000m', 3, 3);

SET @base_id = LAST_INSERT_ID() - 1;

INSERT INTO bobina (corriente_max, resistencia_dc, componente_id) VALUES 
(1.5, 0.1, @base_id + 1),
(1.5, 0.1, @base_id + 2),
(1.5, 0.1, @base_id + 3),
(1.5, 0.1, @base_id + 4),
(1.5, 0.1, @base_id + 5),
(1.5, 0.1, @base_id + 6),
(1.5, 0.1, @base_id + 7),
(1.5, 0.1, @base_id + 8),
(1.5, 0.1, @base_id + 9),
(1.5, 0.1, @base_id + 10),
(0.5, 5, @base_id + 11),
(0.5, 5, @base_id + 12),
(0.5, 5, @base_id + 13),
(0.5, 5, @base_id + 14),
(0.5, 5, @base_id + 15),
(0.5, 5, @base_id + 16),
(0.5, 5, @base_id + 17),
(0.5, 5, @base_id + 18),
(0.5, 5, @base_id + 19),
(0.5, 5, @base_id + 20);