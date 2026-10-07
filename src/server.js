require("dotenv").config({ quiet: true });

const app = require("./app");

const portaInformada = Number(process.env.PORT || 3000);
const porta = Number.isInteger(portaInformada) && portaInformada > 0
  ? portaInformada
  : 3000;

app.listen(porta, () => {
  console.log(`Servidor iniciado em http://localhost:${porta}`);
});
