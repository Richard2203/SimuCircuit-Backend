-- === INSERCIÓN DE SEMICONDUCTORES: REGULADORES DE VOLTAJE ===
USE simucircuit_db;

SET @UNIDAD_NA = 6; 
SET @GRAFICO_REGULADOR = 9;

-- ---------------------------------------------------------
-- 1. INSERTAR PADRES (El Catálogo)
-- ---------------------------------------------------------
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
('Regulador de Voltaje', 'Regulador Positivo Fijo 5V (LM7805)', 'LM7805', @UNIDAD_NA, @GRAFICO_REGULADOR),
('Regulador de Voltaje', 'Regulador Positivo Fijo 12V (LM340T-12)', 'LM340T-12', @UNIDAD_NA, @GRAFICO_REGULADOR),
('Regulador de Voltaje', 'Regulador Negativo Fijo -5V (LM7905)', 'LM7905', @UNIDAD_NA, @GRAFICO_REGULADOR),
('Regulador de Voltaje', 'Regulador Negativo Fijo -12V (L7912)', 'L7912', @UNIDAD_NA, @GRAFICO_REGULADOR),
('Regulador de Voltaje', 'Regulador Positivo Ajustable (LM317)', 'LM317', @UNIDAD_NA, @GRAFICO_REGULADOR),
('Regulador de Voltaje', 'Regulador Negativo Ajustable (LM337)', 'LM337', @UNIDAD_NA, @GRAFICO_REGULADOR);

-- Guardamos el ID base para los hijos
SET @base_id = LAST_INSERT_ID() - 1;

-- ---------------------------------------------------------
-- 2. INSERTAR HIJOS: PARÁMETROS FÍSICOS
-- ---------------------------------------------------------
-- Orden: (id, tipo, voltaje_salida, corriente_maxima, voltaje_entrada_min, voltaje_entrada_max, dropout_voltage, disipacion_maxima, tolerancia, componente_id)

INSERT INTO regulador_voltaje VALUES 
-- Fijos Positivos
(NULL, 'Lineal Fijo', 5.0, 1.500, 7.0, 35.0, 2.0, 15.0, 4.0, @base_id + 1),   -- LM7805 (Ocupa mínimo 7V para dar 5V)
(NULL, 'Lineal Fijo', 12.0, 1.500, 14.5, 35.0, 2.0, 15.0, 4.0, @base_id + 2), -- LM340T-12
-- Fijos Negativos (Sus límites y salidas se expresan en negativo)
(NULL, 'Lineal Fijo', -5.0, 1.500, -7.0, -35.0, 2.0, 15.0, 4.0, @base_id + 3),   -- LM7905
(NULL, 'Lineal Fijo', -12.0, 1.500, -14.5, -35.0, 2.0, 15.0, 4.0, @base_id + 4), -- L7912
-- Ajustables (Su voltaje_salida guarda su Voltaje de Referencia Interno)
(NULL, 'Lineal Ajustable', 1.25, 1.500, 3.0, 40.0, 3.0, 20.0, 4.0, @base_id + 5),   -- LM317
(NULL, 'Lineal Ajustable', -1.25, 1.500, -3.0, -40.0, 3.0, 20.0, 4.0, @base_id + 6); -- LM337