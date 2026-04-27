const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SimuCircuit API',
            version: '1.0.0',
            description: `
API REST para el simulador de circuitos eléctricos **SimuCircuit**.

Permite:
- Consultar el catálogo de circuitos y componentes almacenados en la BD
- Ejecutar simulaciones de análisis **DC** y **AC** a partir de una netlist
- Aplicar teoremas de análisis: **Thévenin/Norton** y **Superposición**

### Formato de Netlist
La netlist es un arreglo de objetos que describe los componentes del circuito.
Cada componente tiene la siguiente estructura básica:
\`\`\`json
{
  "id": "R1",
  "type": "resistencia",
  "value": "1k",
  "nodes": { "n1": "1", "n2": "0" },
  "params": {}
}
\`\`\`

### Nodo de tierra
El nodo \`"0"\` representa el nodo de referencia (GND) y **siempre debe estar presente** en la netlist.
            `,
            contact: {
                name: 'SimuCircuit'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Servidor de desarrollo'
            }
        ],
        tags: [
            {
                name: 'Circuitos',
                description: 'Consulta del catálogo de circuitos guardados en la base de datos'
            },
            {
                name: 'Componentes',
                description: 'Catálogo de componentes electrónicos disponibles'
            },
            {
                name: 'Simulación',
                description: 'Análisis DC y AC de circuitos a partir de una netlist'
            },
            {
                name: 'Teoremas',
                description: 'Análisis por teoremas de circuitos: Thévenin/Norton y Superposición'
            }
        ],
        components: {
            schemas: {
                // ─── Componente de Netlist ───────────────────────────────────────
                ComponenteNetlist: {
                    type: 'object',
                    required: ['id', 'type', 'nodes'],
                    properties: {
                        id: {
                            type: 'string',
                            example: 'R1',
                            description: 'Identificador único del componente (designador)'
                        },
                        type: {
                            type: 'string',
                            example: 'resistencia',
                            description: 'Tipo de componente',
                            enum: [
                                'resistencia',
                                'fuente_voltaje',
                                'fuente_corriente',
                                'capacitor',
                                'bobina',
                                'diodo',
                                'transistor_bjt',
                                'transistor_fet',
                                'regulador_voltaje'
                            ]
                        },
                        value: {
                            type: 'string',
                            example: '1k',
                            description: 'Valor principal del componente. Acepta sufijos: k (×10³), M (×10⁶), m (×10⁻³), u (×10⁻⁶), n (×10⁻⁹), p (×10⁻¹²)'
                        },
                        nodes: {
                            type: 'object',
                            description: 'Nodos de conexión del componente. Las llaves dependen del tipo',
                            example: { n1: '1', n2: '0' }
                        },
                        params: {
                            type: 'object',
                            description: 'Parámetros adicionales según el tipo de componente',
                            example: {}
                        },
                        position: {
                            type: 'object',
                            description: 'Posición visual en el canvas (uso del frontend)',
                            properties: {
                                x: { type: 'number' },
                                y: { type: 'number' }
                            }
                        },
                        rotation: {
                            type: 'number',
                            description: 'Ángulo de rotación en grados (uso del frontend)',
                            example: 0
                        }
                    }
                },

                // ─── Parámetros por tipo de componente ──────────────────────────
                NodosResistencia: {
                    type: 'object',
                    description: 'Nodos para Resistencia, Capacitor, Bobina',
                    properties: {
                        n1: { type: 'string', example: '1' },
                        n2: { type: 'string', example: '0' }
                    }
                },
                NodosFuente: {
                    type: 'object',
                    description: 'Nodos para Fuente de Voltaje o Fuente de Corriente',
                    properties: {
                        pos: { type: 'string', example: '1' },
                        neg: { type: 'string', example: '0' }
                    }
                },
                NodosBJT: {
                    type: 'object',
                    description: 'Nodos para Transistor BJT',
                    properties: {
                        base: { type: 'string', example: '1' },
                        colector: { type: 'string', example: '2' },
                        emisor: { type: 'string', example: '0' }
                    }
                },
                NodosFET: {
                    type: 'object',
                    description: 'Nodos para Transistor FET',
                    properties: {
                        gate: { type: 'string', example: '1' },
                        drain: { type: 'string', example: '2' },
                        source: { type: 'string', example: '0' }
                    }
                },
                NodosRegulador: {
                    type: 'object',
                    description: 'Nodos para Regulador de Voltaje',
                    properties: {
                        in: { type: 'string', example: '1' },
                        out: { type: 'string', example: '2' },
                        gnd: { type: 'string', example: '0' }
                    }
                },
                ParamsFuenteVoltaje: {
                    type: 'object',
                    properties: {
                        dcOrAc: { type: 'string', enum: ['dc', 'ac'], example: 'dc' },
                        amplitude: { type: 'number', description: 'Amplitud en voltios (solo AC)', example: 5 },
                        phase: { type: 'number', description: 'Fase en grados (solo AC)', example: 0 }
                    }
                },
                ParamsFuenteCorriente: {
                    type: 'object',
                    properties: {
                        dcOrAc: { type: 'string', enum: ['dc', 'ac'], example: 'dc' },
                        amplitude: { type: 'number', description: 'Amplitud en amperios (solo AC)', example: 0.01 },
                        phase: { type: 'number', description: 'Fase en grados (solo AC)', example: 0 }
                    }
                },
                ParamsBJT: {
                    type: 'object',
                    properties: {
                        beta: { type: 'number', description: 'Ganancia de corriente (hFE)', example: 100 },
                        Vt: { type: 'number', description: 'Voltaje térmico (V)', example: 0.026 },
                        Is: { type: 'number', description: 'Corriente de saturación inversa (A)', example: 1e-14 }
                    }
                },

                // ─── Configuración AC ────────────────────────────────────────────
                ConfiguracionAC: {
                    type: 'object',
                    required: ['f_inicial', 'f_final'],
                    properties: {
                        f_inicial: {
                            type: 'number',
                            description: 'Frecuencia inicial del barrido en Hz',
                            example: 10
                        },
                        f_final: {
                            type: 'number',
                            description: 'Frecuencia final del barrido en Hz',
                            example: 100000
                        },
                        puntos: {
                            type: 'integer',
                            description: 'Número de puntos del barrido de frecuencia',
                            example: 50,
                            default: 10
                        },
                        barrido: {
                            type: 'string',
                            enum: ['log', 'lineal'],
                            description: 'Tipo de escala del barrido de frecuencia',
                            example: 'log',
                            default: 'log'
                        }
                    }
                },

                // ─── Respuestas de simulación ────────────────────────────────────
                RespuestaExito: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true }
                    }
                },
                RespuestaError: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: false },
                        mensaje: { type: 'string', example: 'Descripción del error' },
                        error: { type: 'string', example: 'Mensaje de excepción' }
                    }
                },
                ResultadoDC: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true },
                        tipo_analisis: { type: 'string', example: 'DC' },
                        data: {
                            type: 'object',
                            properties: {
                                voltages: {
                                    type: 'object',
                                    description: 'Voltaje de cada nodo respecto a tierra (V)',
                                    example: { '1': 5.0, '2': 2.5 }
                                },
                                currents: {
                                    type: 'object',
                                    description: 'Corriente a través de cada componente (A)',
                                    example: { R1: 0.005, R2: 0.005 }
                                },
                                voltageSourceCurrents: {
                                    type: 'object',
                                    description: 'Corriente entregada por cada fuente de voltaje (A)',
                                    example: { V1: 0.01 }
                                }
                            }
                        }
                    }
                },
                ResultadoAC: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true },
                        tipo_analisis: { type: 'string', example: 'AC' },
                        data: {
                            type: 'array',
                            description: 'Un objeto de resultados por cada punto de frecuencia del barrido',
                            items: {
                                type: 'object',
                                properties: {
                                    frecuencia: { type: 'number', example: 1000, description: 'Frecuencia en Hz' },
                                    voltages: {
                                        type: 'object',
                                        description: 'Fasores de voltaje por nodo { magnitud, fase, real, imag }',
                                        example: {
                                            '1': { magnitud: 5.0, fase: 0, real: 5.0, imag: 0 },
                                            '2': { magnitud: 3.5, fase: -45, real: 2.47, imag: -2.47 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },

                // ─── Circuitos ───────────────────────────────────────────────────
                ResumenCircuito: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        nombre: { type: 'string', example: 'Divisor de Voltaje' },
                        descripcion: { type: 'string', example: 'Circuito básico de divisor resistivo' },
                        dificultad: { type: 'string', enum: ['Básico', 'Intermedio', 'Avanzado'], example: 'Básico' },
                        unidad_tematica: { type: 'string', example: 'Leyes de Kirchhoff' },
                        materia: { type: 'string', example: 'Circuitos Eléctricos' },
                        miniatura_svg: { type: 'string', description: 'SVG del circuito codificado como string' },
                        categorias: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['Resistencias', 'Análisis Nodal']
                        }
                    }
                },
                CircuitoCompleto: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true },
                        data: {
                            type: 'object',
                            properties: {
                                circuito: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer', example: 1 },
                                        nombre_circuito: { type: 'string', example: 'Divisor de Voltaje' },
                                        descripcion: { type: 'string' },
                                        dificultad: { type: 'string' },
                                        unidad_tematica: { type: 'string' },
                                        materia: { type: 'string' }
                                    }
                                },
                                netlist: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/ComponenteNetlist' }
                                }
                            }
                        }
                    }
                },

                // ─── Componentes ─────────────────────────────────────────────────
                ComponenteCatalogo: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        nombre: { type: 'string', example: 'Resistencia 1kΩ' },
                        valor: { type: 'string', example: '1k' },
                        unidad: { type: 'string', example: 'Ω' }
                    }
                },

                // ─── Teoremas ────────────────────────────────────────────────────
                ResultadoTheveninNorton: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true },
                        teorema: { type: 'string', example: 'Thévenin / Norton' },
                        data: {
                            type: 'object',
                            properties: {
                                thevenin: {
                                    type: 'object',
                                    properties: {
                                        Vth: { type: 'number', example: 5.0, description: 'Voltaje de Thévenin (V)' },
                                        Rth: { type: 'number', example: 500, description: 'Resistencia de Thévenin (Ω)' },
                                        unidadV: { type: 'string', example: 'V' },
                                        unidadR: { type: 'string', example: 'Ω' }
                                    }
                                },
                                norton: {
                                    type: 'object',
                                    properties: {
                                        In: { type: 'number', example: 0.01, description: 'Corriente de Norton (A)' },
                                        Rn: { type: 'number', example: 500, description: 'Resistencia de Norton (Ω)' },
                                        unidadI: { type: 'string', example: 'A' },
                                        unidadR: { type: 'string', example: 'Ω' }
                                    }
                                },
                                maximaPotencia: {
                                    type: 'object',
                                    properties: {
                                        valor: { type: 'number', example: 0.0125 },
                                        unidad: { type: 'string', example: 'W' }
                                    }
                                },
                                procedimiento: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            paso: { type: 'integer' },
                                            eq: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                ResultadoSuperposicion: {
                    type: 'object',
                    properties: {
                        exito: { type: 'boolean', example: true },
                        teorema: { type: 'string', example: 'Superposición' },
                        data: {
                            type: 'object',
                            properties: {
                                voltajesTotales: {
                                    type: 'object',
                                    description: 'Voltaje total en cada nodo (suma de contribuciones)',
                                    example: { '1': 5.0, '2': 2.5 }
                                },
                                contribuciones: {
                                    type: 'array',
                                    description: 'Resultado parcial por cada fuente activa',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            fuente: { type: 'string', example: 'V1' },
                                            voltajes: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
