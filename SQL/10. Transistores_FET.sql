-- === INSERCIÓN DE SEMICONDUCTORES: TRANSISTORES FET ===
USE simucircuit_db;

SET @UNIDAD_NA = 6; 
SET @GRAFICO_FET = 8;

-- ---------------------------------------------------------
-- 1. INSERTAR PADRES (El Catálogo)
-- ---------------------------------------------------------
INSERT INTO componente (tipo, nombre, valor, unidad_medida_id, componente_grafico_id) VALUES 
('Transistor FET', 'Transistor JFET Canal N (2N5457)', '2N5457', @UNIDAD_NA, @GRAFICO_FET),
('Transistor FET', 'Transistor JFET Canal P (2N5460)', '2N5460', @UNIDAD_NA, @GRAFICO_FET),
('Transistor FET', 'Transistor MOSFET Canal N Señal (2N7000)', '2N7000', @UNIDAD_NA, @GRAFICO_FET),
('Transistor FET', 'Transistor MOSFET Canal N Potencia (IRFZ44N)', 'IRFZ44N', @UNIDAD_NA, @GRAFICO_FET),
('Transistor FET', 'Transistor MOSFET Canal P Potencia (IRF9540N)', 'IRF9540N', @UNIDAD_NA, @GRAFICO_FET);

-- Guardamos el ID base para los hijos
SET @base_id = LAST_INSERT_ID() - 1;

-- ---------------------------------------------------------
-- 2. INSERTAR HIJOS: PARÁMETROS FÍSICOS DE LOS FET
-- ---------------------------------------------------------
-- Orden: (id, tipo, idss, vp, gm, rd, configuracion, modo_operacion, componente_id)

INSERT INTO transistor_fet (tipo, idss, vp, gm, rd, configuracion, modo_operacion, componente_id) VALUES 
('JFET_N', 0.003, -2.000, 0.003, 100000, 'Señal', 'Amplificador Lineal', @base_id + 1), -- JFETs (Ideales para la región lineal/amplificación)
('JFET_P', 0.005,  2.000, 0.004, 100000, 'Señal', 'Amplificador Lineal', @base_id + 2),
('MOSFET_N', 0.200, 2.000, 0.320, 5.000, 'Interruptor', 'Conmutación Rápida', @base_id + 3), -- MOSFETs (Ideales para la región de corte/saturación como interruptores)
('MOSFET_N', 49.000, 3.000, 15.000, 0.017, 'Potencia', 'Control de Motores', @base_id + 4),
('MOSFET_P', 23.000, -3.000, 9.300, 0.117, 'Potencia', 'Control de Motores', @base_id + 5);