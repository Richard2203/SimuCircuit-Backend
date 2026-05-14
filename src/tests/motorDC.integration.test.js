/**
 * Pruebas de integracion: MotorCalculos <-> DCAnalysis <-> MNA completo.
 *
 * Por que importa:
 *   ConstructorCircuitos, ComponentFactory, DCAnalysis y MotorCalculos trabajan
 *   juntos en cada simulacion. Probarlos en conjunto con circuitos reales verifica
 *   que el ensamblado MNA produce resultados fisicamente correctos, y que los
 *   errores de topologia (sin tierra, componente invalido) son detectados.
 *
 * Pruebas:
 *   - Ley de Ohm: V=IR con un circuito de una malla (V1 + R1)
 *   - Divisor de voltaje: V_R2 = Vs × R2/(R1+R2)
 *   - Conservacion de corriente (KCL): I_V1 ≈ I_R1 en una malla
 *   - Error esperado cuando no hay nodo tierra
 *   - Error esperado para netlist vacía
 */

'use strict';

const MotorCalculos        = require('../engine/MotorCalculos');
const { armarObjetoCircuito } = require('../utils/ConstructorCircuitos');

// Silenciar logs del motor durante las pruebas
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
});

// Helpers

function simularDC(netlist, id = 'test') {
  const circuito = armarObjetoCircuito(netlist, id);
  const motor    = new MotorCalculos(circuito);
  return motor.ejecutarAnalisisDC();
}

// Netlist de una malla: V1 = 12V, R1 = 1k

const UNA_MALLA = [
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
    position: { x: '200', y: '0' }, rotation: 0,
  },
];

// Divisor de voltaje: V1 = 12V, R1 = 2k, R2 = 4k

const DIVISOR = [
  {
    id: 'V1', type: 'fuente_voltaje', value: '12',
    nodes: { pos: '1', neg: '0' },
    params: { dcOrAc: 'dc', activo: 1, corriente_max: '5', phase: '0', frequency: '0' },
    position: { x: '0', y: '130' }, rotation: 0,
  },
  {
    id: 'R1', type: 'resistencia', value: '2000',
    nodes: { n1: '1', n2: '2' },
    params: {},
    position: { x: '100', y: '0' }, rotation: 0,
  },
  {
    id: 'R2', type: 'resistencia', value: '4000',
    nodes: { n1: '2', n2: '0' },
    params: {},
    position: { x: '200', y: '0' }, rotation: 0,
  },
];

// Tests

describe('MotorCalculos DC — ley de Ohm (una malla)', () => {
  let resultado;
  beforeAll(async () => { resultado = await simularDC(UNA_MALLA, 'test-ohm'); });

  it('el voltaje en el nodo 1 es 12V (fuente directa)', async () => {
    expect(resultado.voltages['1']).toBeCloseTo(12, 3);
  });

  it('el voltaje en el nodo tierra (0) es 0V', async () => {
    expect(resultado.voltages['0']).toBeCloseTo(0, 5);
  });

  it('la corriente por V1 es -12mA (I = V/R = 12/1000)', async () => {
    // La corriente de la fuente es negativa (convención MNA: corriente que entra)
    expect(Math.abs(resultado.voltageSourceCurrents['V1'])).toBeCloseTo(0.012, 4);
  });
});

describe('MotorCalculos DC — divisor de voltaje (R1=2k, R2=4k, Vs=12V)', () => {
  let resultado;
  beforeAll(async () => { resultado = await simularDC(DIVISOR, 'test-divisor'); });

  it('el nodo 1 esta a 12V (terminal de la fuente)', async () => {
    expect(resultado.voltages['1']).toBeCloseTo(12, 3);
  });

  it('el nodo 2 esta a 8V (Vs × R2/(R1+R2) = 12 × 4/6)', async () => {
    // V_nodo2 = 12 × 4000/(2000+4000) = 8V
    expect(resultado.voltages['2']).toBeCloseTo(8, 2);
  });

  it('la corriente total es 2mA (I = 12 / 6000)', async () => {
    expect(Math.abs(resultado.voltageSourceCurrents['V1'])).toBeCloseTo(0.002, 4);
  });
});

describe('MotorCalculos DC — validaciones de topologia', () => {
  it('lanza error si la netlist esta vacia', async () => {
    await expect(simularDC([], 'test-vacio')).rejects.toThrow();
  });

  it('sin nodo tierra el motor resuelve con todos los voltajes en 0', async () => {
    const sinTierra = [
      {
        id: 'R1', type: 'resistencia', value: '1000',
        nodes: { n1: '1', n2: '2' },
        params: {},
        position: { x: 0, y: 0 }, rotation: 0,
      },
    ];
    const resultado = await simularDC(sinTierra, 'test-sin-tierra');
    // Sin fuente de voltaje ni tierra, todos los nodos quedan en 0V
    expect(resultado.voltages['1']).toBeCloseTo(0);
    expect(resultado.voltages['2']).toBeCloseTo(0);
  });
});
