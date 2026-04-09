-- 1. Topología y Leyes Básicas (Circuitos Eléctricos)
INSERT INTO categoria (nombre, descripcion) VALUES
('Circuito en Serie', 'Circuitos donde los componentes están conectados en cadena, uno tras otro.'),
('Circuito en Paralelo', 'Circuitos donde los componentes están conectados entre sí en paralelo.'),
('Circuito Mixto (Serie-Paralelo)', 'Circuitos que combinan configuraciones en serie y paralelo.'),
('Divisor de Voltaje', 'Circuitos que dividen un voltaje de entrada en partes más pequeñas.'),
('Divisor de Corriente', 'Circuitos que dividen una corriente de entrada en partes más pequeñas.'),
('Una Sola Fuente', 'Circuitos que utilizan una sola fuente de alimentación.'),
('Varias Fuentes', 'Circuitos que utilizan múltiples fuentes de alimentación.'),
-- 2. Métodos de Análisis y Teoremas
('Análisis de Nodos', 'Método de análisis que utiliza las leyes de Corrientes de Kirchhoff para resolver circuitos.'),
('Análisis de Mallas', 'Método de análisis que utiliza las leyes de Voltaje de Kirchhoff para resolver circuitos.'),
('Teorema de Thévenin / Norton', 'Teoremas que permiten simplificar circuitos complejos en equivalentes más simples.'),
('Superposición', 'Principio que permite analizar el efecto de cada fuente de forma independiente.'),
('Máxima Transferencia de Potencia', 'Principio que establece las condiciones para transferir la máxima potencia desde una fuente a una carga.'),
-- 3. Dominio de Frecuencia y Tiempo
('Corriente Directa (DC)', 'Circuitos que operan con corriente que fluye en una sola dirección.'),
('Corriente Alterna (AC)', 'Circuitos que operan con corriente que cambia de dirección periódicamente.'),
('Filtros Pasivos', 'Circuitos que permiten pasar ciertas frecuencias mientras atienden otras.'),
('Respuesta en Frecuencia / Diagramas de Bode', 'Análisis de cómo un circuito responde a diferentes frecuencias.'),
('Circuitos Transitorios', 'Circuitos que exhiben comportamiento cambiante en el tiempo, como los circuitos RC, RL y RLC.'),
-- 4. Electrónica Analógica (Semiconductores)
('Diodos: Rectificadores', 'Diodos utilizados para convertir corriente alterna en corriente directa (Media onda, Onda completa)'),
('Diodos: Recortadores y Sujetadores', 'Diodos utilizados para limitar o mantener un nivel de voltaje específico en una señal.'),
('Amplificadores con BJT', 'Amplificadores que utilizan transistores bipolares para aumentar la ganancia de una señal.'),
('Amplificadores con FET / MOSFET', 'Amplificadores que utilizan transistores de efecto de campo para aumentar la ganancia de una señal.'),
('Fuentes de Alimentación / Regulación', 'Circuitos que proporcionan energía eléctrica a otros circuitos, regulando el voltaje y corriente.');