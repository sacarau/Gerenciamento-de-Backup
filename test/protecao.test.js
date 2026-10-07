const test = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  compactarArquivoProtegido,
  criptografarArquivo,
  descriptografarArquivo,
  extrairZipProtegido,
} = require("../src/services/protecao");

async function pastaTemporaria(t) {
  const diretorio = await fsp.mkdtemp(path.join(os.tmpdir(), "backup-test-"));
  t.after(() => fsp.rm(diretorio, { recursive: true, force: true }));
  return diretorio;
}

test("criptografa e descriptografa um backup com AES-256-GCM", async (t) => {
  const diretorio = await pastaTemporaria(t);
  const origem = path.join(diretorio, "futebol.backup");
  const restaurado = path.join(diretorio, "restaurado.backup");
  const conteudo = Buffer.from("conteudo ficticio do backup\n".repeat(40));
  await fsp.writeFile(origem, conteudo);

  const protegido = await criptografarArquivo(origem, "chave-segura-123");
  const bytesProtegidos = await fsp.readFile(protegido.arquivo);

  assert.equal(protegido.algoritmo, "AES-256-GCM");
  assert.equal(bytesProtegidos.includes(conteudo), false);

  await descriptografarArquivo(protegido.arquivo, "chave-segura-123", restaurado);
  assert.deepEqual(await fsp.readFile(restaurado), conteudo);
});

test("rejeita uma chave AES incorreta sem deixar arquivo parcial", async (t) => {
  const diretorio = await pastaTemporaria(t);
  const origem = path.join(diretorio, "futebol.backup");
  const restaurado = path.join(diretorio, "invalido.backup");
  await fsp.writeFile(origem, "backup de teste");
  const protegido = await criptografarArquivo(origem, "chave-correta-123");

  await assert.rejects(
    descriptografarArquivo(protegido.arquivo, "chave-errada-123", restaurado),
    /Verifique a chave AES/i,
  );
  await assert.rejects(fsp.access(restaurado));
});

test("gera ZIP AES-256 e exige a senha correta para extração", async (t) => {
  const diretorio = await pastaTemporaria(t);
  const origem = path.join(diretorio, "futebol.backup");
  const conteudo = "conteudo compactado protegido";
  await fsp.writeFile(origem, conteudo);

  const compactado = await compactarArquivoProtegido(origem, "senha-zip-123");
  const extraido = await extrairZipProtegido(compactado.arquivo, "senha-zip-123");
  t.after(() => fsp.rm(extraido.diretorio, { recursive: true, force: true }));

  assert.equal(compactado.protecao, "ZIP AES-256");
  assert.equal(await fsp.readFile(extraido.arquivo, "utf8"), conteudo);

  await assert.rejects(
    extrairZipProtegido(compactado.arquivo, "senha-incorreta"),
    /Verifique a senha/i,
  );
});
