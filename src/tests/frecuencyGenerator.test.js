/**
 * Pruebas de generarFrecuencias — generador de barridos de frecuencia para analisis AC.
 *
 * Por que importa:
 *   ACAnalysis itera sobre el arreglo que devuelve esta funcion. Si los puntos
 *   de frecuencia son incorrectos (fuera de rango, tipo invalido, distribucion erronea),
 *   el diagrama de Bode del frontend mostrara la respuesta en frecuencias incorrectas.
 *
 * Pruebas:
 *   - Barrido lineal: tamaño, primer y ultimo punto
 *   - Barrido logaritmico: escala log10 entre puntos consecutivos
 *   - Barrido por decadas: avance correcto de 10× entre grupos de puntos
 *   - Barrido por octavas: avance correcto de 2× entre grupos de puntos
 *   - Validaciones de entrada: tipo invalido, frecuencia <=0 en log
 *   - Caso limite de 1 punto
 */

'use strict';

const generarFrecuencias = require('../engine/utils/frecuencyGenerator');

// Silenciar console.log del modulo durante las pruebas
beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterAll(() => console.log.mockRestore());

// Barrido lineal

describe('generarFrecuencias — barrido lineal', () => {
  it('devuelve exactamente N puntos', () => {
    const f = generarFrecuencias(1, 1000, 10, 'lineal');
    expect(f).toHaveLength(10);
  });

  it('el primer punto es f_inicial', () => {
    const f = generarFrecuencias(1, 1000, 10, 'lineal');
    expect(f[0]).toBeCloseTo(1);
  });

  it('el último punto es f_final', () => {
    const f = generarFrecuencias(1, 1000, 10, 'lineal');
    expect(f[f.length - 1]).toBeCloseTo(1000);
  });

  it('los puntos están distribuidos uniformemente', () => {
    const f = generarFrecuencias(0, 100, 6, 'lineal');
    const paso = f[1] - f[0];
    for (let i = 1; i < f.length; i++) {
      expect(f[i] - f[i - 1]).toBeCloseTo(paso, 5);
    }
  });

  it('con 1 punto devuelve solo f_inicial', () => {
    const f = generarFrecuencias(60, 1000, 1, 'lineal');
    expect(f).toHaveLength(1);
    expect(f[0]).toBeCloseTo(60);
  });
});

// Barrido logaritmico

describe('generarFrecuencias — barrido logarítmico', () => {
  it('devuelve exactamente N puntos', () => {
    const f = generarFrecuencias(1, 1000, 10, 'log');
    expect(f).toHaveLength(10);
  });

  it('el primer y último punto coinciden con los límites', () => {
    const f = generarFrecuencias(10, 10000, 5, 'log');
    expect(f[0]).toBeCloseTo(10);
    expect(f[f.length - 1]).toBeCloseTo(10000);
  });

  it('la diferencia de log10 entre puntos consecutivos es constante', () => {
    const f = generarFrecuencias(1, 1000, 4, 'log');
    const diffs = [];
    for (let i = 1; i < f.length; i++) {
      diffs.push(Math.log10(f[i]) - Math.log10(f[i - 1]));
    }
    const d0 = diffs[0];
    diffs.forEach(d => expect(d).toBeCloseTo(d0, 5));
  });

  it('lanza error si f_inicial <= 0', () => {
    expect(() => generarFrecuencias(0, 1000, 10, 'log')).toThrow();
  });

  it('lanza error si f_final <= 0', () => {
    expect(() => generarFrecuencias(1, -100, 10, 'log')).toThrow();
  });
});

// Barrido por decadas

describe('generarFrecuencias — barrido por decada', () => {
  it('el primer punto es f_inicial', () => {
    const f = generarFrecuencias(1, 1000, 10, 'decada');
    expect(f[0]).toBeCloseTo(1);
  });

  it('el último punto es <= f_final', () => {
    const f = generarFrecuencias(1, 1000, 10, 'decada');
    expect(f[f.length - 1]).toBeLessThanOrEqual(1000 * 1.001);
  });

  it('cada paso multiplica por 10^(1/puntos)', () => {
    const puntos = 10;
    const multiplicador = Math.pow(10, 1 / puntos);
    const f = generarFrecuencias(1, 100, puntos, 'decada');
    for (let i = 1; i < Math.min(f.length, 5); i++) {
      expect(f[i] / f[i - 1]).toBeCloseTo(multiplicador, 5);
    }
  });
});

// Barrido por octavas

describe('generarFrecuencias — barrido por octava', () => {
  it('el primer punto es f_inicial', () => {
    const f = generarFrecuencias(100, 1600, 4, 'octava');
    expect(f[0]).toBeCloseTo(100);
  });

  it('el último punto es <= f_final', () => {
    const f = generarFrecuencias(100, 1600, 4, 'octava');
    expect(f[f.length - 1]).toBeLessThanOrEqual(1600 * 1.001);
  });

  it('cada paso multiplica por 2^(1/puntos)', () => {
    const puntos = 4;
    const multiplicador = Math.pow(2, 1 / puntos);
    const f = generarFrecuencias(100, 1600, puntos, 'octava');
    for (let i = 1; i < Math.min(f.length, 5); i++) {
      expect(f[i] / f[i - 1]).toBeCloseTo(multiplicador, 5);
    }
  });
});

// Tipo invalidos

describe('generarFrecuencias — tipo invalido', () => {
  it('lanza error con tipo de barrido desconocido', () => {
    expect(() => generarFrecuencias(1, 1000, 10, 'cuadratico')).toThrow();
  });

  it('acepta "octave" y "decade" como aliases en inglés', () => {
    expect(() => generarFrecuencias(1, 1000, 5, 'octave')).not.toThrow();
    expect(() => generarFrecuencias(1, 1000, 5, 'decade')).not.toThrow();
  });
});
