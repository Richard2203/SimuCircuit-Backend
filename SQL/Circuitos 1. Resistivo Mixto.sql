-- === 1. INSERCIÓN DEL CIRCUITO (PADRE) ===
INSERT INTO circuito (nombre, descripcion, layout_data, miniatura_svg, activo, dificultad, tema, unidad_tematica, materia) 
VALUES (
    'Circuito Resistivo Mixto Básico', 
    'Circuito con 4 resistencias en configuración serie-paralelo alimentadas por una fuente DC de 12V. Ideal para practicar reducción de resistencias y divisor de voltaje.', 
    '{"zoom": 1, "pan": {"x": 0, "y": 0}}', 
    '<svg>...</svg>', -- Aquí iría el string de tu miniatura SVG
    TRUE, 
    'Básico', 
    '1. Unidades eléctricas.\n2. Ley de Ohm.\n3. Código de colores.', 
    'Fundamentos de Circuitos Eléctricos', 
    'Circuitos Eléctricos'
);

-- Guardamos el ID del circuito recién creado en una variable
SET @circuito_id = LAST_INSERT_ID();

-- === 2. INSERCIÓN DE CATEGORÍAS (TABLA PIVOTE) ===
-- Asumiendo que 'Mixto' tiene el ID 4 y 'Corriente Directa' tiene el ID 11 en tu tabla 'categoria'
INSERT INTO circuito_categoria (circuito_id, categoria_id) VALUES 
(@circuito_id, 3),  -- Mixto
(@circuito_id, 6),  -- Una Sola Fuente de Alimentación
(@circuito_id, 13); -- Corriente Directa (DC)

-- === 3. INSERCIÓN DE INSTANCIAS DE COMPONENTES ===

SET @ID_FUENTE_V = (SELECT id FROM componente WHERE nombre = 'Fuente Variable de Laboratorio de 12V' AND valor='12' LIMIT 1);
SET @ID_RESISTOR_1 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 100 a 0.25W' AND valor='100' LIMIT 1);
SET @ID_RESISTOR_2 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 220 a 0.25W' AND valor='220' LIMIT 1);
SET @ID_RESISTOR_3 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 470 a 0.25W' AND valor='470' LIMIT 1);
SET @ID_RESISTOR_4 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 1k a 0.25W' AND valor='1k' LIMIT 1);

INSERT INTO instancia_componente (circuito_id, componente_id, designador, posicion_x, posicion_y, rotacion) VALUES 
-- La Fuente de Voltaje (V1)
(@circuito_id, @ID_FUENTE_V, 'V1', 0, 50, 90),
-- Resistencia 1 (R1)
(@circuito_id, @ID_RESISTOR_1, 'R1', 50, 0, 0),
-- Resistencia 2 (R2)
(@circuito_id, @ID_RESISTOR_2, 'R2', 100, 50, 90),
-- Resistencia 4 (R4)
(@circuito_id, @ID_RESISTOR_4, 'R4', 150, 0, 0),
-- Resistencia 3 (R3)
(@circuito_id, @ID_RESISTOR_3, 'R3', 200, 50, 90);

-- Después del INSERT múltiple en instancia_componente:
SET @inst_base = LAST_INSERT_ID();

-- === 4. INSERCIÓN DE NODOS ===
-- Creamos los nodos identificando cada conexión entre todos los componentes. Para este circuito, los nodos se asignan de la siguiente manera:
INSERT INTO nodo (numero_nodo, circuito_id, instancia_componente_id, pin_terminal, posicion_x, posicion_y) VALUES 
('0', 1, 1, 'Negativo', 0, 100), -- V1 terminal negativo a Tierra (GND)
('0', 1, 3, 'Pin 2', 100, 100), -- R2 pin 2 a Tierra (GND)
('0', 1, 5, 'Pin 2', 200, 100), -- R3 pin 2 a Tierra (GND)
('1', 1, 1, 'Positivo', 0, 0), -- V1 terminal positiva a R1 pin 1
('1', 1, 2, 'Pin 1', 0, 0), -- R1 pin 1 a V1 terminal positiva
('2', 1, 2, 'Pin 2', 100, 0), -- R1 pin 2 a R2 pin 1 y R4 pin 1
('2', 1, 3, 'Pin 1', 100, 0), -- R2 pin 1 a R1 pin 2 y R4 pin 1
('2', 1, 4, 'Pin 1', 100, 0), -- R4 pin 1 a R1 pin 2 y R2 pin 1
('3', 1, 4, 'Pin 2', 200, 0), -- R4 pin 2 a R3 pin 1
('3', 1, 5, 'Pin 1', 200, 0); -- R3 pin 1 a R4 pin 2
