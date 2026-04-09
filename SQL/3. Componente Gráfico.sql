use simucircuit_db;

-- Aún no se ha definido el componente gráfico para cada componente
-- imagino que utilizarás 1 para las resistencias,  1 por cada tipo de capacitor, 1 para las bobinas, 1 por cada tipo de diodo, etc.
INSERT INTO componente_grafico (layout_visual, descripcion) VALUES 
('{}', 'Gráfico genérico para resistencias E24'),
('{}', 'Gráfico genérico para capacitores E12'),
('{}', 'Gráfico genérico para bobinas E6'),
('{}', 'Gráfico genérico para Fuentes de Voltaje'),
('{}', 'Gráfico genérico para Fuentes de Corriente'),
('{}', 'Gráfico genérico para Diodos'),
('{}', 'Gráfico genérico para Transistores BJT'),
('{}', 'Gráfico genérico para Transistores FET'),
('{}', 'Gráfico genérico para Reguladores de Voltaje');

