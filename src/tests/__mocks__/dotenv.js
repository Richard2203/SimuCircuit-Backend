// Mock de dotenv para pruebas — evita la dependencia en el entorno de test
module.exports = {
  config: () => {},
  parse: (src) => ({}),
};
