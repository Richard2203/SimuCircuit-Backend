function parsearValorElectrico(valor) {
    // Si ya es un número puro, lo regresamos tal cual
    if (typeof valor === 'number') return valor;
    
    // Convertimos a string por seguridad, por si llega algo raro
    const strValor = String(valor);

    let multiplicador = 1;
    
    if (strValor.includes('G')) multiplicador = 1000000000; //Giga 10^9
    if (strValor.includes('M')) multiplicador = 1000000; //Mega 10^6
    if (strValor.includes('k')) multiplicador = 1000; //Kilo 10^3
    if (strValor.includes('m')) multiplicador = 0.001; //Mili 10^-3
    if (strValor.includes('u')) multiplicador = 0.000001; //Micro 10^-6
    if (strValor.includes('n')) multiplicador = 0.000000001; //Nano 10^-9
    if (strValor.includes('p')) multiplicador = 0.000000000001; //Pico 10^-12
    
    const numeroPuro = parseFloat(strValor.replace(/[a-zA-Z]/g, ''));
    console.log(`Valor original: ${valor}, Número puro: ${numeroPuro}, Multiplicador: ${multiplicador}`);

    return numeroPuro * multiplicador;
}

module.exports = parsearValorElectrico;