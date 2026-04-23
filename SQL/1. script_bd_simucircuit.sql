drop database if exists simucircuit_db;
create database if not exists simucircuit_db;
use simucircuit_db;

CREATE TABLE unidad_medida (
    id INT PRIMARY KEY AUTO_INCREMENT,           
    nombre VARCHAR(50) NOT NULL,                 -- Nombre completo (ej: "Ohmio")
    valor_nominal VARCHAR(5) NOT NULL,           -- 
    simbolo VARCHAR(5) NOT NULL                  -- Símbolo (ej: "Ω", "F", "V")
);

CREATE TABLE componente_grafico(
	id INT PRIMARY KEY AUTO_iNCREMENT,
    layout_visual json,                        -- Propiedades visuales en Three.js
    descripcion TEXT                            -- Descripción funcional del componente
);

CREATE TABLE componente (
    id INT PRIMARY KEY AUTO_INCREMENT,           
    nombre VARCHAR(100) NOT NULL,                -- Nombre descriptivo (ej: "Resistencia, capacitor, etc")
    tipo VARCHAR(20) NOT NULL,                   -- Para identificar el tipo de componente (ej: "Resistencia", "Capacitor", "Fuente de Voltaje")
    valor varchar(20) NOT NULL,                 -- Valor del componente
    unidad_medida_id INT,                        -- Unidad de medida (FK a unidad_medida)
    componente_grafico_id INT NOT NULL,
    FOREIGN KEY (unidad_medida_id) REFERENCES unidad_medida(id),
    FOREIGN KEY (componente_grafico_id) REFERENCES componente_grafico(id)
);

CREATE TABLE categoria (
    id INT PRIMARY KEY AUTO_INCREMENT,           
    nombre VARCHAR(100) NOT NULL,                -- Nombre de la categoría (ej: "Circuitos Básicos")
    descripcion TEXT                   
);

CREATE TABLE circuito (
    id INT PRIMARY KEY AUTO_INCREMENT,           
    nombre VARCHAR(250) NOT NULL,                -- Nombre del circuito (ej: "Divisor de Voltaje")
    descripcion TEXT,                            -- Descripción del funcionamiento
    layout_data JSON,                            -- Configuración del canvas y metadatos
    miniatura_svg TEXT,                          -- Imagen SVG del circuito                           
    activo BOOLEAN DEFAULT FALSE,                -- Estado (false=inactivo, true=mostrar en simulacion)
    dificultad VARCHAR(50) DEFAULT 'Básico',      -- Nivel: 'Básico', 'Intermedio', 'Avanzado'
    tema varchar(100) not null,
    unidad_tematica varchar(100) not null,
    materia varchar(30) not null
);

CREATE TABLE circuito_categoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    circuito_id INT NOT NULL,                  -- ID del circuito (ej: 1, 2, 3)                    
    categoria_id INT NOT NULL,                -- ID de la categoría (ej: 1, 2, 3)               
    FOREIGN KEY (categoria_id) REFERENCES categoria(id),
    FOREIGN KEY (circuito_id) REFERENCES circuito(id) ON DELETE CASCADE
);

CREATE TABLE instancia_componente (
    id INT PRIMARY KEY AUTO_INCREMENT,
    circuito_id INT NOT NULL,                    -- ¿En qué circuito se colocó?
    componente_id INT NOT NULL,                  -- ¿Qué componente del catálogo es?
    designador VARCHAR(20) NOT NULL,             -- ej: "R1", "Q1", "V1"
    posicion_x DECIMAL(8,4) NOT NULL,            -- Coordenada X central en Three.js
    posicion_y DECIMAL(8,4) NOT NULL,            -- Coordenada Y central en Three.js
    rotacion INT DEFAULT 0,                      -- 0, 90, 180, 270 grados
    FOREIGN KEY (circuito_id) REFERENCES circuito(id) ON DELETE CASCADE,
    FOREIGN KEY (componente_id) REFERENCES componente(id)
);

CREATE TABLE nodo (
    id INT PRIMARY KEY AUTO_INCREMENT,    
    numero_nodo character(2),                             -- identificacion de nodo especifico en el circuito. ej: "0" (GND), "1", "2".
    circuito_id INT,                             -- Circuito (FK a circuito)
    instancia_componente_id INT NOT NULL,                 -- ¡Apunta a la instancia del componente, no al catálogo!
    pin_terminal VARCHAR(20),                             -- ej: "Anodo", "Base", "Pin_1" (Opcional, pero muy útil)
    posicion_x decimal(8,4) NOT NULL,                     -- Coordenada X en el canvas (píxeles)
    posicion_y decimal(8,4) NOT NULL,                     -- Coordenada Y en el canvas (píxeles)
    FOREIGN KEY (circuito_id) REFERENCES circuito(id) ON DELETE CASCADE,
    FOREIGN KEY (instancia_componente_id) REFERENCES instancia_componente(id) ON DELETE CASCADE
);

CREATE TABLE resistencia(
	id INT PRIMARY KEY AUTO_INCREMENT,
    banda_uno varchar(20) not null,
    banda_dos varchar(20) not null,
    banda_tres varchar(20) not null,
    banda_tolerancia varchar(20) not null,
    potencia_nominal decimal(4,2) not null,
    componente_id int not null,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE capacitor(
	id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_dioelectrico varchar(50) not null,
    voltaje decimal(4,2) not null,
    polaridad boolean,
    componente_id int not null,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE bobina(
	id INT PRIMARY KEY AUTO_INCREMENT, 
    corriente_max decimal(7,3) not null,
    resistencia_dc decimal(7,3) not null,
    componente_id int not null,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE diodo(
	id INT PRIMARY KEY AUTO_INCREMENT,
    tipo varchar(70) not null,
    corriente_max decimal(7,3) not null,
    voltaje_inv_max decimal(7,3) not null,
    caida_tension decimal(7,3) not null,
    componente_id int not null,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE fuente_voltaje(
	id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_senial varchar(50) null default 'DC', -- DC, AC_SENOIDAL, AC_CUADRADA, etc.
    frecuencia decimal(10,2) null default 0, -- Frecuencia en Hz (0 para DC)
    fase decimal(10,2) null default 0, -- Desfase en grados
    activo boolean,
    corriente_max decimal(4,2) not null,
    componente_id int not null,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE fuente_corriente(
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_senial varchar(50) null default 'DC', -- DC, AC_SENOIDAL, AC_CUADRADA, etc.
    frecuencia decimal(10,2) null default 0, -- Frecuencia en Hz (0 para DC)
    fase decimal(10,2) null default 0, -- Desfase en grados
    activo BOOLEAN DEFAULT FALSE,
    voltaje_max DECIMAL(6,2) NOT NULL,
    componente_id INT NOT NULL,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE regulador_voltaje (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(50) NOT NULL,                        -- Lineal o conmutado
    voltaje_salida DECIMAL(6,3) NOT NULL,             -- Vout nominal
    corriente_maxima DECIMAL(6,3) NOT NULL,           -- Corriente máxima de salida (A)
    voltaje_entrada_min DECIMAL(6,3) NOT NULL,        -- Voltaje mínimo de entrada (V)
    voltaje_entrada_max DECIMAL(6,3) NOT NULL,        -- Voltaje máximo de entrada (V)
    dropout_voltage DECIMAL(5,3) NOT NULL,            -- Diferencia mínima entre Vin y Vout
    disipacion_maxima DECIMAL(8,3),                   -- Máxima potencia disipada (W)
    tolerancia DECIMAL(5,2),                          -- % de variación permitida
    componente_id INT NOT NULL,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE transistor_bjt (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(20) NOT NULL,                        -- NPN o PNP
    configuracion VARCHAR(50),                        -- Emisor común, colector común, base común
    beta DECIMAL(6,2) NOT NULL,                       -- Ganancia de corriente (hFE)
    vbe_saturacion DECIMAL(5,3) NOT NULL,             -- Caída base-emisor en saturación (V)
    vce_saturacion DECIMAL(5,3) NOT NULL,             -- Caída colector-emisor en saturación (V)
    corriente_colector_max DECIMAL(8,3) NOT NULL,     -- Corriente máxima de colector (A)
    potencia_maxima DECIMAL(8,3) NOT NULL,            -- Potencia máxima disipada (W)
    frecuencia_transicion DECIMAL(8,2),               -- Frecuencia de transición (MHz)
    modo_operacion VARCHAR(50),                       -- Activa, corte, saturación
    componente_id INT NOT NULL,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);

CREATE TABLE transistor_fet (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(20) NOT NULL,                        -- JFET, MOSFET, etc.
    idss DECIMAL(8,3),                                -- Corriente máxima sin polarización (A)
    vp DECIMAL(6,3),                                  -- Voltaje de pinzamiento (V)
    gm DECIMAL(8,3),                                  -- Transconductancia (S)
    rd DECIMAL(10,3),                                 -- Resistencia de drenaje (Ω)
    configuracion VARCHAR(50),                        -- Fuente común, drenaje común, etc.
    modo_operacion VARCHAR(50),                       -- Corte, saturación, triodo, etc.
    componente_id INT NOT NULL,
    FOREIGN KEY (componente_id) REFERENCES componente(id) ON DELETE CASCADE
);