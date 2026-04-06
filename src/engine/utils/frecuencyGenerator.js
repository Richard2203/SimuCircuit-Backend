function generarFrecuencias(fInicial, fFinal, puntos, tipo) {
    const frecuencias = [];

    // Validar que las frecuencuas sean mayores a 0 para barridos logarítmicos
    if (tipo === 'log' && (fInicial <= 0 || fFinal <= 0)) {
        throw new Error('Para barridos logarítmicos, de década u octava, las frecuencias deben ser mayores a 0');
    }

    // Normalizar el string para evitar problemas de mayúsculas/minúsculas
    console.log(`Generando frecuencias desde ${fInicial} Hz hasta ${fFinal} Hz, con ${puntos} puntos, tipo: ${tipo}`);
    const tipoBarrido = tipo.toLowerCase();

    if (tipoBarrido === 'lineal') {
        // 'puntos' es el numero total de puntos incluyendo fInicial y fFinal
        if(puntos <= 1) return [fInicial]; // Si solo se pide 1 punto, devolvemos el inicial
        const paso = (fFinal - fInicial) / (puntos - 1);
        for (let i = 0; i < puntos; i++) {
            frecuencias.push(fInicial + i * paso);
        }
    }
    else if (tipoBarrido === 'log') {
        // 'puntos' es el numero total de puntos logarítmicos entre fInicial y fFinal
        if(puntos <= 1) return [fInicial]; // Si solo se pide 1 punto, devolvemos el inicial
        const logInicial = Math.log10(fInicial);
        const logFinal = Math.log10(fFinal);
        const pasoLog = (logFinal - logInicial) / (puntos - 1);
        for (let i = 0; i < puntos; i++) {
            frecuencias.push(Math.pow(10, logInicial + i * pasoLog));
        }
    }
    else if (tipoBarrido === 'decada' || tipoBarrido === 'decade') {
        // 'puntos' es el numero de puntos POR década
        let fActual = fInicial;

        // Factor multiplicativo para avanzar una década: 10^(1/puntos)
        const muliplicador = Math.pow(10, 1.0 / puntos);

        // El 1.0001 evita que se salga del rango por errores de precisión al multiplicar
        while (fActual <= fFinal * 1.0001) {
            frecuencias.push(fActual);
            fActual *= muliplicador;
        }
    }
    else if (tipoBarrido === 'octava' || tipoBarrido === 'octave') {
        // 'puntos' es el numero de puntos POR octava
        let fActual = fInicial;

        // Factor multiplicativo para avanzar una octava: 2^(1/puntos)
        const muliplicador = Math.pow(2, 1.0 / puntos);

        // El 1.0001 evita que se salga del rango por errores de precisión al multiplicar
        while (fActual <= fFinal * 1.0001) {
            frecuencias.push(fActual);
            fActual *= muliplicador;
        }
    }
    else {
        throw new Error('Tipo de barrido no válido');
    }
    return frecuencias;
}

module.exports = generarFrecuencias;