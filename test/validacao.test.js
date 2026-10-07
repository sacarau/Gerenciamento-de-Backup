const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validarConfiguracaoConexao,
  validarParametrosProcesso,
  validarParametrosRestauracao,
} = require("../src/utils/validacao");

test("aceita uma configuração PostgreSQL local válida", () => {
  const resultado = validarConfiguracaoConexao({
    host: "localhost",
    porta: "5432",
    banco: "futebol_times",
    usuario: "postgres",
    senha: "senha-de-teste",
  });

  assert.equal(resultado.valido, true);
  assert.equal(resultado.dados.porta, 5432);
});

test("rejeita porta, banco e senha inválidos", () => {
  const resultado = validarConfiguracaoConexao({
    host: "localhost",
    porta: "99999",
    banco: "futebol times",
    usuario: "postgres",
    senha: "",
  });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.erros.length, 3);
});

test("rejeita caracteres impróprios no servidor", () => {
  const resultado = validarConfiguracaoConexao({
    host: "localhost; comando",
    porta: 5432,
    banco: "futebol_times",
    usuario: "postgres",
    senha: "teste",
  });

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros[0], /servidor válido/i);
});

test("aceita os parâmetros completos da execução", () => {
  const resultado = validarParametrosProcesso({
    destino: "backups",
    quantidadeManter: "5",
    destinoAdicional: "copias",
    caminhoPgDump: "",
    modoManutencao: "automatico",
  });

  assert.equal(resultado.valido, true);
  assert.equal(resultado.dados.quantidadeManter, 5);
});

test("rejeita destinos iguais, retenção negativa e modo desconhecido", () => {
  const resultado = validarParametrosProcesso({
    destino: "backups",
    quantidadeManter: -1,
    destinoAdicional: "backups/",
    modoManutencao: "inventado",
  });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.erros.length, 3);
});

test("valida as credenciais somente quando AES e ZIP estão habilitados", () => {
  const resultado = validarParametrosProcesso({
    destino: "backups",
    quantidadeManter: 3,
    modoManutencao: "automatico",
    criptografar: true,
    chaveCriptografia: "curta",
    compactar: true,
    senhaZip: "123",
    emailFalha: "invalido",
  });

  assert.equal(resultado.valido, false);
  assert.equal(resultado.erros.length, 3);
  assert.match(resultado.erros.join(" "), /chave AES/i);
  assert.match(resultado.erros.join(" "), /senha do ZIP/i);
});

test("aceita restauração protegida em banco diferente da origem", () => {
  const resultado = validarParametrosRestauracao({
    arquivoBackup: "backups/futebol.zip",
    bancoDestino: "futebol_restaurado",
    senhaZip: "senha-zip-123",
  }, "futebol_times");

  assert.equal(resultado.valido, true);
  assert.equal(resultado.dados.bancoDestino, "futebol_restaurado");
});

test("impede restauração sobre o banco de origem", () => {
  const resultado = validarParametrosRestauracao({
    arquivoBackup: "backups/futebol.backup",
    bancoDestino: "futebol_times",
  }, "futebol_times");

  assert.equal(resultado.valido, false);
  assert.match(resultado.erros.join(" "), /diferente do banco de origem/i);
});
