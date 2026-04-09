-- === INSERCIÓN DE SEMICONDUCTORES: TRANSISTORES BJT ===
USE simucircuit_db;

SET @UNIDAD_NA = 6; 
SET @GRAFICO_BJT = 7;

-- ---------------------------------------------------------
-- 1. INSERTAR PADRES (El Catálogo)
-- ---------------------------------------------------------
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
('Transistor BJT', 'Transistor NPN Uso General (2N2222A)', '2N2222A', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor NPN Uso General (2N3904)', '2N3904', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor NPN Alta Ganancia (BC547B)', 'BC547B', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor NPN Alta Corriente (ST9013H)', 'ST9013H', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor NPN de Potencia (TIP41C)', 'TIP41C', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor PNP Uso General (2N3906)', '2N3906', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor PNP Alta Ganancia (BC557)', 'BC557', @UNIDAD_NA, @GRAFICO_BJT),
('Transistor BJT', 'Transistor PNP de Potencia (TIP42C)', 'TIP42C', @UNIDAD_NA, @GRAFICO_BJT);

-- Guardamos el ID base para los hijos
SET @base_id = LAST_INSERT_ID() - 1;

-- ---------------------------------------------------------
-- 2. INSERTAR HIJOS: PARÁMETROS FÍSICOS DE LOS BJT
-- ---------------------------------------------------------
-- Orden de columnas: 
-- (tipo, configuracion, beta, vbe_saturacion, vce_saturacion, corriente_colector_max, potencia_maxima, frecuencia_transicion, modo_operacion, componente_id)
INSERT INTO transistor_bjt VALUES 
-- 1. 2N2222A: Beta estándar, soporta muy buena corriente (800mA)
(NULL, 'NPN', 'Uso General', 100.0, 0.600, 0.300, 0.800, 0.500, 300.0, 'Amplificador/Interruptor', @base_id + 1),
-- 2. 2N3904: Beta estándar, pero solo soporta 200mA (se quema más fácil que el 2222)
(NULL, 'NPN', 'Uso General', 100.0, 0.650, 0.200, 0.200, 0.625, 300.0, 'Amplificador/Interruptor', @base_id + 2),
-- 3. BC547B: La variante 'B' garantiza un Beta alto (~200). Solo 100mA.
(NULL, 'NPN', 'Audio/Señal', 200.0, 0.700, 0.200, 0.100, 0.500, 300.0, 'Amplificador Lineal', @base_id + 3),
-- 4. ST9013H: La variante 'H' tiene un Beta ~150. Ideal para relevadores (500mA).
(NULL, 'NPN', 'Carga Media', 150.0, 0.800, 0.600, 0.500, 0.625, 150.0, 'Interruptor', @base_id + 4),
-- 5. TIP41C: ¡El monstruo! Soporta 6 Amperios, pero su Beta cae en picada (~15)
(NULL, 'NPN', 'Potencia', 15.0, 1.500, 1.500, 6.000, 65.000, 3.0, 'Potencia', @base_id + 5),
-- 6. 2N3906: Complemento del 3904. 200mA max.
(NULL, 'PNP', 'Uso General', 100.0, 0.650, 0.250, 0.200, 0.625, 250.0, 'Amplificador/Interruptor', @base_id + 6),
-- 7. BC557: Complemento del BC547. Alta ganancia, bajo ruido. 100mA max.
(NULL, 'PNP', 'Audio/Señal', 200.0, 0.700, 0.200, 0.100, 0.500, 150.0, 'Amplificador Lineal', @base_id + 7),
-- 8. TIP42C: Complemento del TIP41C. El tanque PNP de 6 Amperios.
(NULL, 'PNP', 'Potencia', 15.0, 1.500, 1.500, 6.000, 65.000, 3.0, 'Potencia', @base_id + 8);