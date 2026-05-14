/**
 * Recibe un valor numérico puro del backend y lo formatea a notación de ingeniería.
 * Ejemplo: formatoIngenieria(0.002238754, 'A') -> "2.23 mA"
 */
function formatoIngenieria(valorNum, unidad = '') {
    if (typeof valorNum !== 'number' || Number.isNaN(valorNum)) return `0 ${unidad}`;
    if (valorNum === 0) return `0 ${unidad}`;

    const abs = Math.abs(valorNum);
    const signo = valorNum < 0 ? '-' : '';
    let coef, prefix;

    if      (abs >= 1e9)  { coef = abs / 1e9;  prefix = 'G'; }
    else if (abs >= 1e6)  { coef = abs / 1e6;  prefix = 'M'; }
    else if (abs >= 1e3)  { coef = abs / 1e3;  prefix = 'k'; }
    else if (abs >= 1)    { coef = abs;        prefix = '';  }
    else if (abs >= 1e-3) { coef = abs * 1e3;  prefix = 'm'; }
    else if (abs >= 1e-6) { coef = abs * 1e6;  prefix = 'µ'; }
    else if (abs >= 1e-9) { coef = abs * 1e9;  prefix = 'n'; }
    else                  { coef = abs * 1e12; prefix = 'p'; }

    // Number(..).toString() quita los ceros a la derecha innecesarios
    const numStr = Number(coef.toFixed(3)).toString(); 
    return `${signo}${numStr} ${prefix}${unidad}`;
}

module.exports = formatoIngenieria;