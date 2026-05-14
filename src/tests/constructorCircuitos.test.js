/**
 * Pruebas de ConstructorCircuitos — preprocesamiento de netlist y construccion del circuito.
 *
 * Por que importa:
 *   armarObjetoCircuito es el unico punto de entrada al motor. Si nodoIdOf extrae
 *   mal los IDs de nodo, o si expandirPotenciometros calcula mal Ra/Rb, el MNA
 *   opera sobre una topologia incorrecta y el resultado de simulacion es erroneo.
 *
 * Que se prueba:
 *   - nodoIdOf: extrae nodo de formato moderno {nodo,x,y} y formato legacy (string)
 *   - expandirPotenciometros: convierte resistencia_variable en dos resistencias en serie
 *   - expandirPotenciometros: respeta cursor_pos (wiper) para dividir Ra y Rb
 *   - expandirPotenciometros: no modifica componentes que no son potenciometros
 *   - armarObjetoCircuito: el objeto resultante tiene componentes y nodos correctos
 *   - armarObjetoCircuito: lanza error si un componente tiene datos invalidos
 */

'use strict';

const {
  armarObjetoCircuito,
  expandirPotenciometros,
  nodoIdOf,
} = require('../utils/ConstructorCircuitos');

// Fixtures

const NETLIST_UNA_MALLA = [
  {
    id: 'V1', type: 'fuente_voltaje', value: '12',
    nodes: { pos: '1', neg: '0' },
    params: { dcOrAc: 'dc', activo: 1, corriente_max: '5', phase: '0', frequency: '0' },
    position: { x: '0', y: '130' }, rotation: 0,
  },
  {
    id: 'R1', type: 'resistencia', value: '1000',
    nodes: { n1: '1', n2: '0' },
    params: {},
    position: { x: '100', y: '0' }, rotation: 0,
  },
];

const POT_3T = {
  id: 'POT1', type: 'resistencia_variable', value: '10000',
  nodes: { n1: '1', n2: '2', n3: '0' },
  params: { wiper: 0.3 },
  position: { x: '200', y: '100' }, rotation: 0,
};

// nodoIdOf

describe('nodoIdOf — extraccion de ID de nodo', () => {
  it('extrae "nodo" de formato moderno { nodo, x, y }', () => {
    expect(nodoIdOf({ nodo: '1', x: 0, y: 0 })).toBe('1');
  });

  it('convierte número a string ("0" desde nodo tierra)', () => {
    expect(nodoIdOf({ nodo: 0 })).toBe('0');
  });

  it('devuelve el string tal cual si el nodo ya es string', () => {
    expect(nodoIdOf('3')).toBe('3');
  });

  it('maneja formato legacy con campo "id"', () => {
    expect(nodoIdOf({ id: '2' })).toBe('2');
  });

  it('devuelve null para null', () => {
    expect(nodoIdOf(null)).toBeNull();
  });

  it('devuelve null para undefined', () => {
    expect(nodoIdOf(undefined)).toBeNull();
  });
});

// expandirPotenciometros

describe('expandirPotenciometros — conversion a dos resistencias', () => {
  it('convierte una resistencia_variable en dos componentes', () => {
    const resultado = expandirPotenciometros([POT_3T]);
    expect(resultado).toHaveLength(2);
  });

  it('los IDs de las dos resistencias son {id}_AW y {id}_WB', () => {
    const [aw, wb] = expandirPotenciometros([POT_3T]);
    expect(aw.id).toBe('POT1_AW');
    expect(wb.id).toBe('POT1_WB');
  });

  it('el tipo de las dos resistencias es "resistencia"', () => {
    const [aw, wb] = expandirPotenciometros([POT_3T]);
    expect(aw.type).toBe('resistencia');
    expect(wb.type).toBe('resistencia');
  });

  it('Ra + Rb = valor total del potenciometro', () => {
    const [aw, wb] = expandirPotenciometros([POT_3T]);
    const total = parseFloat(aw.value) + parseFloat(wb.value);
    expect(total).toBeCloseTo(10000, 1);
  });

  it('cursor_pos=30 asigna Ra=30% y Rb=70% del total', () => {
    const [aw, wb] = expandirPotenciometros([POT_3T]);
    expect(parseFloat(aw.value)).toBeCloseTo(3000, 1);
    expect(parseFloat(wb.value)).toBeCloseTo(7000, 1);
  });

  it('sin cursor_pos divide 50/50 por defecto', () => {
    const pot50 = { ...POT_3T, params: {} };
    const [aw, wb] = expandirPotenciometros([pot50]);
    expect(parseFloat(aw.value)).toBeCloseTo(5000, 1);
    expect(parseFloat(wb.value)).toBeCloseTo(5000, 1);
  });

  it('no modifica componentes que no son resistencia_variable', () => {
    const resultado = expandirPotenciometros(NETLIST_UNA_MALLA);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].id).toBe('V1');
    expect(resultado[1].id).toBe('R1');
  });
});

// armarObjetoCircuito

describe('armarObjetoCircuito — construccion del objeto circuito', () => {
  it('devuelve un objeto con componentes y nodos', () => {
    const c = armarObjetoCircuito(NETLIST_UNA_MALLA, 'test-dc');
    expect(c.componentes).toBeDefined();
    expect(c.nodos).toBeDefined();
  });

  it('el numero de componentes coincide con la netlist', () => {
    const c = armarObjetoCircuito(NETLIST_UNA_MALLA, 'test-dc');
    expect(c.componentes).toHaveLength(NETLIST_UNA_MALLA.length);
  });

  it('los nodos incluyen el nodo tierra ("0")', () => {
    const c = armarObjetoCircuito(NETLIST_UNA_MALLA, 'test-dc');
    const ids = c.nodos.map(n => n.id);
    expect(ids).toContain('0');
  });

  it('obtenerNodoTierra() devuelve "0"', () => {
    const c = armarObjetoCircuito(NETLIST_UNA_MALLA, 'test-dc');
    expect(c.obtenerNodoTierra()).toBe('0');
  });

  it('lanza error si un componente tiene tipo desconocido', () => {
    const netlistRota = [{ id: 'X1', type: 'componente_inexistente', value: '1', nodes: { n1: '1', n2: '0' }, params: {}, position: { x: 0, y: 0 }, rotation: 0 }];
    expect(() => armarObjetoCircuito(netlistRota, 'test-error')).toThrow();
  });
});
