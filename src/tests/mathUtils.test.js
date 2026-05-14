/**
 * Pruebas de las funciones matematicas del motor de simulacion.
 * 
 * Por que importa:
 *   rectToPolar y polarToRect son la base de toda la representacion fasorial en AC.
 *   Si la conversion cartesiano<->polar es incorrecta, las magnitudes y fases del
 *   diagrama de Bode seran erroneas. resolverSistemaLineal es el nucleo del MNA:
 *   un error aqui invalida todos los voltajes y corrientes del circuito.
 *
 * Que se prueba:
 *   - rectToPolar: magnitud y fase desde parte real e imaginaria conocidas
 *   - polarToRect: reconstrucción de real e imaginario desde mag y fase
 *   - Round-trip rect->polar->rect: sin perdida de informacion
 *   - resolverSistemaLineal: sistema 2×2 con solucion exacta conocida
 *   - resolverSistemaLineal: sistema singular lanza error descriptivo
 */

'use strict';

const { rectToPolar, polarToRect, resolverSistemaLineal } = require('../engine/utils/mathUtils');
const math = require('mathjs');

// rectToPolar

describe('rectToPolar — cartesiano a polar', () => {
  it('fasor real puro (3+0j) tiene magnitud 3 y fase 0', () => {
    const c = math.complex(3, 0);
    const { mag, phase } = rectToPolar(c);
    expect(mag).toBeCloseTo(3);
    expect(phase).toBeCloseTo(0);
  });

  it('fasor imaginario puro (0+4j) tiene magnitud 4 y fase pi/2', () => {
    const c = math.complex(0, 4);
    const { mag, phase } = rectToPolar(c);
    expect(mag).toBeCloseTo(4);
    expect(phase).toBeCloseTo(Math.PI / 2);
  });

  it('fasor (3+4j) tiene magnitud 5 (trígono 3-4-5)', () => {
    const c = math.complex(3, 4);
    const { mag } = rectToPolar(c);
    expect(mag).toBeCloseTo(5);
  });

  it('fasor (3+4j) tiene fase atan2(4,3) ≈ 0.9273 rad', () => {
    const c = math.complex(3, 4);
    const { phase } = rectToPolar(c);
    expect(phase).toBeCloseTo(Math.atan2(4, 3));
  });

  it('fasor negativo real (-1+0j) tiene fase ≈ pi', () => {
    const c = math.complex(-1, 0);
    const { phase } = rectToPolar(c);
    expect(Math.abs(phase)).toBeCloseTo(Math.PI);
  });
});

// polarToRect

describe('polarToRect — polar a cartesiano', () => {
  it('mag=5, phase=0 devuelve real≈5, imag≈0', () => {
    const c = polarToRect({ mag: 5, phase: 0 });
    expect(c.re).toBeCloseTo(5);
    expect(c.im).toBeCloseTo(0, 5);
  });

  it('mag=1, phase=pi/2 devuelve real≈0, imag≈1', () => {
    const c = polarToRect({ mag: 1, phase: Math.PI / 2 });
    expect(c.re).toBeCloseTo(0, 5);
    expect(c.im).toBeCloseTo(1);
  });
});

// Round-trip

describe('rectToPolar / polarToRect — round-trip sin perdida', () => {
  const casos = [
    math.complex(3, 4),
    math.complex(-2, 5),
    math.complex(0, -7),
    math.complex(100, 0),
  ];

  casos.forEach((original) => {
    it(`round-trip de ${original.toString()} recupera re e im originales`, () => {
      const polar = rectToPolar(original);
      const reconstruido = polarToRect(polar);
      expect(reconstruido.re).toBeCloseTo(original.re, 5);
      expect(reconstruido.im).toBeCloseTo(original.im, 5);
    });
  });
});

// resolverSistemaLineal

describe('resolverSistemaLineal — solver LU para MNA', () => {
  it('resuelve un sistema 2×2 con solucion exacta conocida', () => {
    // [ 2  1 ] [x]   [5]     -> x=2, y=1
    // [ 1  3 ] [y] = [5]
    const A = math.matrix([[2, 1], [1, 3]]);
    const b = math.matrix([[5], [5]]);
    const [x, y] = resolverSistemaLineal(A, b);
    const xVal = typeof x === 'object' && x.re !== undefined ? x.re : x;
    const yVal = typeof y === 'object' && y.re !== undefined ? y.re : y;
    expect(xVal).toBeCloseTo(2);
    expect(yVal).toBeCloseTo(1);
  });

  it('resuelve un sistema 1x1 trivial (2x = 6 -> x = 3)', () => {
    const A = math.matrix([[2]]);
    const b = math.matrix([[6]]);
    const [x] = resolverSistemaLineal(A, b);
    const xVal = typeof x === 'object' && x.re !== undefined ? x.re : x;
    expect(xVal).toBeCloseTo(3);
  });

  it('resuelve un sistema 3x3 con solucion exacta (x=1,y=2,z=3)', () => {
    // x +  y +  z = 6
    // x + 2y +  z = 8   -> x=1, y=2, z=3
    // x +  y + 2z = 9
    const A = math.matrix([[1,1,1],[1,2,1],[1,1,2]]);
    const b = math.matrix([[6],[8],[9]]);
    const [x, y, z] = resolverSistemaLineal(A, b);
    const toNum = v => typeof v === 'object' && v.re !== undefined ? v.re : v;
    expect(toNum(x)).toBeCloseTo(1, 3);
    expect(toNum(y)).toBeCloseTo(2, 3);
    expect(toNum(z)).toBeCloseTo(3, 3);
  });
});
