const test = require("node:test");
const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { aplicarRetencao, nomeArquivoBackup } = require("../src/services/backup");

test("gera um nome previsível e seguro para o arquivo de backup", () => {
  const date = new Date(2026, 8, 30, 19, 5, 7, 42);
  const name = nomeArquivoBackup("Projeto2", date);

  assert.equal(name, "Projeto2_20260930_190507_042.backup");
});

test("retenção considera backup simples, AES e ZIP", async (t) => {
  const diretorio = await fsp.mkdtemp(path.join(os.tmpdir(), "retencao-test-"));
  t.after(() => fsp.rm(diretorio, { recursive: true, force: true }));
  const nomes = [
    "futebol_times_20261007_100000_000.backup",
    "futebol_times_20261007_110000_000.backup.aes",
    "futebol_times_20261007_120000_000.zip",
  ];

  for (let indice = 0; indice < nomes.length; indice += 1) {
    const arquivo = path.join(diretorio, nomes[indice]);
    await fsp.writeFile(arquivo, "teste");
    const momento = new Date(2026, 9, 7, 10 + indice, 0, 0);
    await fsp.utimes(arquivo, momento, momento);
  }

  const removidos = await aplicarRetencao(diretorio, "futebol_times", 2);
  assert.equal(removidos.length, 1);
  assert.equal(path.basename(removidos[0]), nomes[0]);
  assert.deepEqual((await fsp.readdir(diretorio)).sort(), nomes.slice(1).sort());
});
