-- === 1. INSERCIÓN DEL CIRCUITO (PADRE) ===
INSERT INTO circuito (nombre, descripcion, layout_data, miniatura_svg, activo, dificultad, tema, unidad_tematica, materia) 
VALUES (
    'Fuentes de Voltaje y Corriente independientes', 
    'Circuito mixto con excitación de múltiples fuentes independientes (voltaje y corriente). Ideal para aplicar el Teorema de Superposición o Análisis de Nodos.', 
    '{"zoom": 1, "pan": {"x": 0, "y": 0}}', 
    '<svg>...</svg>', 
    TRUE, 
    'Intermedio',
    '1. Elementos Activos de circuitos eléctricos.\n2. Análisis de Nodos.\n3. Teorema de Superposición',
    'Fundamentos de Circuitos Eléctricos', 
    'Circuitos Eléctricos'
);

SET @circuito_id = LAST_INSERT_ID();

-- === 2. INSERCIÓN DE CATEGORÍAS (TABLA PIVOTE) ===
-- (Asigna los IDs correspondientes a tus categorías reales)
INSERT INTO circuito_categoria (circuito_id, categoria_id) VALUES
(@circuito_id, 3),  -- ID para Mixto
(@circuito_id, 8), -- ID para Análisis de Nodos
(@circuito_id, 11), -- ID para Teorema de Superposición
(@circuito_id, 13); -- ID para Corriente Directa (DC)

-- === 3. INSERCIÓN DE INSTANCIAS DE COMPONENTES ===
-- Buscamos los IDs del catálogo padre
SET @ID_FUENTE_V = (SELECT id FROM componente WHERE tipo = 'Fuente de Voltaje' AND valor='12' LIMIT 1);
SET @ID_RESISTOR_1 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 1k a 0.25W' AND valor='1k' LIMIT 1);
SET @ID_RESISTOR_3 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 470 a 0.25W' AND valor='470' LIMIT 1);
SET @ID_FUENTE_I = (SELECT id FROM componente WHERE tipo = 'Fuente de Corriente' AND valor='2m' LIMIT 1);
SET @ID_RESISTOR_2 = (SELECT id FROM componente WHERE nombre = 'Resistencia de 2.2k a 0.25W' AND valor='2.2k' LIMIT 1);

INSERT INTO instancia_componente (circuito_id, componente_id, designador, posicion_x, posicion_y, rotacion) VALUES 
(@circuito_id, @ID_FUENTE_V, 'V1', 0, 50, 90),     -- Instancia Base + 0
(@circuito_id, @ID_RESISTOR_1, 'R1', 50, 0, 0),    -- Instancia Base + 1
(@circuito_id, @ID_RESISTOR_3, 'R3', 100, 50, 90), -- Instancia Base + 2
(@circuito_id, @ID_FUENTE_I, 'I1', 150, 50, 90),   -- Instancia Base + 3
(@circuito_id, @ID_RESISTOR_2, 'R2', 200, 0, 0);   -- Instancia Base + 4

-- Capturamos el primer ID que se generó en este bloque de inserción
SET @inst_base = LAST_INSERT_ID();

-- === 4. INSERCIÓN DE NODOS ===
-- Vinculamos usando matemáticas simples con @inst_base
INSERT INTO nodo (numero_nodo, circuito_id, instancia_componente_id, pin_terminal, posicion_x, posicion_y) VALUES 
-- Conexiones al NODO 0 (Tierra)
('0', @circuito_id, @inst_base + 0, 'Negativo', 0, 100),   -- V1
('0', @circuito_id, @inst_base + 2, 'Pin 2', 100, 100),    -- R3
('0', @circuito_id, @inst_base + 3, 'Negativo', 150, 100), -- I1 (La flecha apunta arriba, succiona de GND)
('0', @circuito_id, @inst_base + 4, 'Pin 2', 250, 100),    -- R2 (Su lado derecho baja a Tierra)
-- Conexiones al NODO 1 (Entre V1 y R1)
('1', @circuito_id, @inst_base + 0, 'Positivo', 0, 0),     -- V1
('1', @circuito_id, @inst_base + 1, 'Pin 1', 0, 0),        -- R1
-- Conexiones al NODO 2 (El "Supernodo" superior)
('2', @circuito_id, @inst_base + 1, 'Pin 2', 100, 0),      -- R1
('2', @circuito_id, @inst_base + 2, 'Pin 1', 100, 0),      -- R3
('2', @circuito_id, @inst_base + 3, 'Positivo', 150, 0),   -- I1 (Inyecta hacia el Nodo 2)
('2', @circuito_id, @inst_base + 4, 'Pin 1', 200, 0);      -- R2