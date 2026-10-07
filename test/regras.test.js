const test = require("node:test");
const assert = require("node:assert/strict");
const { ACOES, decidirManutencao } = require("../src/services/regras");

test("não executa manutenção com menos de 30 dias", () => {
  assert.equal(decidirManutencao("automatico", 29).acao, ACOES.NENHUMA);
});

test("executa VACUUM nos limites de 30 e 60 dias", () => {
  assert.equal(decidirManutencao("automatico", 30).acao, ACOES.VACUUM);
  assert.equal(decidirManutencao("automatico", 60).acao, ACOES.VACUUM);
});

test("executa manutenção completa acima de 60 dias ou sem histórico", () => {
  assert.equal(decidirManutencao("automatico", 61).acao, ACOES.COMPLETA);
  assert.equal(decidirManutencao("automatico", null).acao, ACOES.COMPLETA);
});

test("a escolha manual substitui a regra automática", () => {
  const decisao = decidirManutencao("manual_vacuum", 5);
  assert.equal(decisao.acao, ACOES.VACUUM);
  assert.equal(decisao.origem, "MANUAL");
});
