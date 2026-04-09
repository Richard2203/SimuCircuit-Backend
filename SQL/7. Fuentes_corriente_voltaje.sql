use simucircuit_db;
-- === INSERCIÓN DE FUENTES DE VOLTAJE Y CORRIENTE ===

SET @UNIDAD_VOLTIO = 4;
SET @UNIDAD_AMPERIO = 5;
SET @GRAFICO_FUENTE_V = 4;
SET @GRAFICO_FUENTE_I = 5;

-- ---------------------------------------------------------
-- 1. INSERTAR PADRES (El Catálogo General)
-- ---------------------------------------------------------
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
-- Fuentes de Voltaje
('Fuente de Voltaje', 'Canal Fijo TTL / USB', '5', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Batería Cuadrada', '9', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 12V', '12', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V), -- Inicia en 12V por defecto
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 15V', '15', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 18V', '18', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 20V', '20', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 22V', '22', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 25V', '25', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V), 
('Fuente de Voltaje', 'Fuente de Voltaje Variable de Laboratorio de 30V', '30', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V), 
('Fuente de Voltaje', 'Batería AA', '1.5', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Voltaje', 'Batería de Plomo (Auto)', '12', @UNIDAD_VOLTIO, @GRAFICO_FUENTE_V),
('Fuente de Corriente', 'Fuente de Corriente Constante de 1mA', '1m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I), -- Fuentes de Corriente
('Fuente de Corriente', 'Fuente de Corriente Constante de 2mA', '2m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente Constante de 3mA', '3m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente Constante de 4mA', '4m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente Constante de 5mA', '5m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Lazo de Control Industrial', '20m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente de Potencia de 1A', '1', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente de Potencia de 2A', '2', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente de Potencia de 3A', '3', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente de Potencia de 4A', '4', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente de Potencia de 5A', '5', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente Variable de Laboratorio de 0.5A', '500m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I),
('Fuente de Corriente', 'Fuente de Corriente Variable de Laboratorio de 0.8A', '800m', @UNIDAD_AMPERIO, @GRAFICO_FUENTE_I);

-- ---------------------------------------------------------
-- 2. INSERTAR HIJOS: FUENTES DE VOLTAJE
-- ---------------------------------------------------------
-- Atrapamos el ID base de este bloque (restamos 1 para sumar consecutivamente)
SET @base_id = LAST_INSERT_ID() - 1;

INSERT INTO fuente_voltaje (activo, corriente, componente_id) VALUES 
(TRUE, 3.00, @base_id + 1),   -- 5V Fijos (TTL/USB)
(TRUE, 0.50, @base_id + 2),   -- Batería 9V
(TRUE, 5.00, @base_id + 3),   -- Fuente Lab 12V
(TRUE, 5.00, @base_id + 4),   -- Fuente Lab 15V
(TRUE, 5.00, @base_id + 5),   -- Fuente Lab 18V
(TRUE, 5.00, @base_id + 6),   -- Fuente Lab 20V
(TRUE, 5.00, @base_id + 7),   -- Fuente Lab 22V
(TRUE, 5.00, @base_id + 8),   -- Fuente Lab 25V
(TRUE, 5.00, @base_id + 9),   -- Fuente Lab 30V
(TRUE, 1.00, @base_id + 10),  -- Pila AA
(TRUE, 50.00, @base_id + 11); -- Batería de Plomo

-- ---------------------------------------------------------
-- 3. INSERTAR HIJOS: FUENTES DE CORRIENTE
-- ---------------------------------------------------------
-- La primera fuente de corriente empieza 11 posiciones después de la primera de voltaje

INSERT INTO fuente_corriente (activo, voltaje_max, componente_id) VALUES 
(TRUE, 30.00, @base_id + 12), -- 1mA
(TRUE, 30.00, @base_id + 13), -- 2mA
(TRUE, 30.00, @base_id + 14), -- 3mA
(TRUE, 30.00, @base_id + 15), -- 4mA
(TRUE, 30.00, @base_id + 16), -- 5mA
(TRUE, 24.00, @base_id + 17), -- 20mA (Lazo Industrial a 24V)
(TRUE, 30.00, @base_id + 18), -- 1A
(TRUE, 30.00, @base_id + 19), -- 2A
(TRUE, 30.00, @base_id + 20), -- 3A
(TRUE, 30.00, @base_id + 21), -- 4A
(TRUE, 30.00, @base_id + 22), -- 5A
(TRUE, 30.00, @base_id + 23), -- 0.5A
(TRUE, 30.00, @base_id + 24); -- 0.8A