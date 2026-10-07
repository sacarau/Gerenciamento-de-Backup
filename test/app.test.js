const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");

test("a rota de saúde informa que a aplicação está ativa", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise((resolve) => server.once("listening", resolve));
  const endereco = server.address();
  const resposta = await fetch(`http://127.0.0.1:${endereco.port}/api/health`);
  const corpo = await resposta.json();

  assert.equal(resposta.status, 200);
  assert.equal(corpo.status, "ok");
  assert.equal(corpo.versao, "1.0.0");
});

test("um identificador de processo inválido devolve 400", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise((resolve) => server.once("listening", resolve));
  const endereco = server.address();
  const resposta = await fetch(`http://127.0.0.1:${endereco.port}/api/processos/invalido`);
  const corpo = await resposta.json();

  assert.equal(resposta.status, 400);
  assert.equal(corpo.sucesso, false);
});

test("um identificador de restauração inválido devolve 400", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise((resolve) => server.once("listening", resolve));
  const endereco = server.address();
  const resposta = await fetch(`http://127.0.0.1:${endereco.port}/api/restauracao/invalido`);
  const corpo = await resposta.json();

  assert.equal(resposta.status, 400);
  assert.equal(corpo.sucesso, false);
});

test("uma rota desconhecida da API devolve 404", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise((resolve) => server.once("listening", resolve));
  const endereco = server.address();
  const resposta = await fetch(`http://127.0.0.1:${endereco.port}/api/inexistente`);
  const corpo = await resposta.json();

  assert.equal(resposta.status, 404);
  assert.equal(corpo.sucesso, false);
});
