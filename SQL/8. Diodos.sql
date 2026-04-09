use simucircuit_db;

-- === INSERCIÓN DE SEMICONDUCTORES: DIODOS ===
SET @UNIDAD_NA = 6; 
SET @GRAFICO_DIODO = 6; 

-- ---------------------------------------------------------
-- 1. INSERTAR PADRES (Catálogo General de Diodos)
-- ---------------------------------------------------------
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
-- Señal y Alta Velocidad
('Diodo', 'Diodo de Señal Rápido (1N4148)', '1N4148', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'Diodo Schottky Rápido (1N5819)', '1N5819', @UNIDAD_NA, @GRAFICO_DIODO),
-- Familia Rectificadora 1N400x (1 Amperio)
('Diodo', 'Diodo Rectificador (1N4002)', '1N4002', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'Diodo Rectificador (1N4004)', '1N4004', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'Diodo Rectificador (1N4007)', '1N4007', @UNIDAD_NA, @GRAFICO_DIODO),
-- Diodos Zener
('Diodo', 'Diodo Zener de 3.3V (1N4728A)', '1N4728A', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'Diodo Zener de 5.1V (1N4733A)', '1N4733A', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'Diodo Zener de 12V (1N4742A)', '1N4742A', @UNIDAD_NA, @GRAFICO_DIODO),
-- LEDs Normales (20mA)
('Diodo', 'LED Rojo Estándar 5mm', 'ROJO', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'LED Verde Estándar 5mm', 'VERDE', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'LED Amarillo Estándar 5mm', 'AMARILLO', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'LED Azul Estándar 5mm', 'AZUL', @UNIDAD_NA, @GRAFICO_DIODO),
-- LEDs Especiales
('Diodo', 'LED Blanco Ultrabrillante 5mm', 'BLANCO UB', @UNIDAD_NA, @GRAFICO_DIODO),
('Diodo', 'LED Infrarrojo (IR) Tx', 'INFRARROJO', @UNIDAD_NA, @GRAFICO_DIODO);

-- Guardamos el ID base para los hijos
SET @base_id = LAST_INSERT_ID() - 1;

-- ---------------------------------------------------------
-- 2. INSERTAR HIJOS: PARÁMETROS FÍSICOS DE DIODOS
-- ---------------------------------------------------------
INSERT INTO diodo (tipo, corriente_max, voltaje_inv_max, caida_tension, componente_id) VALUES 
-- Señal y Schottky
('Señal', 0.300, 100.0, 0.700, @base_id + 1),        -- 1N4148
('Schottky', 1.000, 40.0, 0.200, @base_id + 2),      -- 1N5819
-- Familia Rectificadora 1N400x
('Rectificador', 1.000, 100.0, 0.700, @base_id + 3), -- 1N4002 (PIV 100V)
('Rectificador', 1.000, 400.0, 0.700, @base_id + 4), -- 1N4004 (PIV 400V)
('Rectificador', 1.000, 1000.0, 0.700, @base_id + 5),-- 1N4007 (PIV 1000V)
-- Zeners
('Zener', 0.276, 3.3, 0.700, @base_id + 6),          -- Zener 3.3V 
('Zener', 0.178, 5.1, 0.700, @base_id + 7),          -- Zener 5.1V 
('Zener', 0.076, 12.0, 0.700, @base_id + 8),         -- Zener 12V 
-- LEDs Estándar
('LED', 0.020, 5.0, 2.000, @base_id + 9),            -- Rojo
('LED', 0.020, 5.0, 2.200, @base_id + 10),           -- Verde
('LED', 0.020, 5.0, 2.100, @base_id + 11),           -- Amarillo
('LED', 0.020, 5.0, 3.300, @base_id + 12),           -- Azul
-- LEDs Especiales
('LED_Ultrabrillante', 0.030, 5.0, 3.300, @base_id + 13), -- Blanco Ultra
('LED_IR', 0.050, 5.0, 1.200, @base_id + 14);             -- Infrarrojo