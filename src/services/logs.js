const fsp = require("node:fs/promises");
const path = require("node:path");

const DIRETORIO_LOGS = path.resolve(
  process.env.LOGS_DIR || path.join(__dirname, "..", "..", "logs"),
);

function nomeSeguro(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_");
}

function formatarLogs(logs) {
  return logs.map((entrada) => {
    return "[" + entrada.momento + "] [" + entrada.nivel + "] " + entrada.mensagem;
  }).join("\n") + "\n";
}

async function salvarLogExecucao(id, logs, status) {
  const diretorio = path.join(DIRETORIO_LOGS, "execucoes");
  await fsp.mkdir(diretorio, { recursive: true });
  const arquivo = path.join(
    diretorio,
    nomeSeguro(id) + "_" + String(status).toLowerCase() + ".log",
  );
  const conteudo = formatarLogs(logs);
  await fsp.writeFile(arquivo, conteudo, "utf8");
  return { arquivo, conteudo };
}

function limparCabecalho(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

async function simularEnvioEmailLog({ id, destinatario, arquivoLog, conteudoLog }) {
  const diretorio = path.join(DIRETORIO_LOGS, "caixa-saida-email");
  await fsp.mkdir(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, nomeSeguro(id) + "_falha.eml");
  const email = [
    "From: plataforma-backup@localhost",
    "To: " + limparCabecalho(destinatario),
    "Subject: Falha no processo de backup " + nomeSeguro(id),
    "Date: " + new Date().toUTCString(),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Esta é uma simulação comprovável de envio do log de falha.",
    "O arquivo também foi preservado em: " + arquivoLog,
    "",
    conteudoLog,
  ].join("\r\n");
  await fsp.writeFile(arquivo, email, "utf8");
  return arquivo;
}

module.exports = {
  formatarLogs,
  salvarLogExecucao,
  simularEnvioEmailLog,
};
