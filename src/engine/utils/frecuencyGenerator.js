function generarFrecuencias(fInicial, fFinal, puntos, tipo) {
    const frecuencias = [];
    if (tipo === 'lineal') {
        const paso = (fFinal - fInicial) / (puntos - 1);
        for (let i = 0; i < puntos; i++) {
            frecuencias.push(fInicial + i * paso);
        }
    } else if (tipo === 'log') {
        const logInicial = Math.log10(fInicial);
        const logFinal = Math.log10(fFinal);
        const pasoLog = (logFinal - logInicial) / (puntos - 1);
        for (let i = 0; i < puntos; i++) {
            frecuencias.push(Math.pow(10, logInicial + i * pasoLog));
        }
    } else {
        throw new Error('Tipo de barrido no válido');
    }
    return frecuencias;
}

module.exports = generarFrecuencias;