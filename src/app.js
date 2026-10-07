const path = require("path");
const express = require("express");
const helmet = require("helmet");
const conexaoRouter = require("./routes/conexao");
const historicoRouter = require("./routes/historico");
const processosRouter = require("./routes/processos");
const restauracaoRouter = require("./routes/restauracao");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "50kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aplicacao: "Plataforma de Gerenciamento de Backup",
    versao: "1.0.0",
  });
});

app.use("/api/conexao", conexaoRouter);
app.use("/api/processos", processosRouter);
app.use("/api/restauracao", restauracaoRouter);
app.use("/api/historico", historicoRouter);
app.use(express.static(publicDirectory));

app.use("/api", (_req, res) => {
  res.status(404).json({
    sucesso: false,
    mensagem: "Rota da API não encontrada.",
  });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(publicDirectory, "404.html"));
});

app.use((error, _req, res, _next) => {
  console.error("Erro interno não tratado", {
    nome: error.name,
    momento: new Date().toISOString(),
  });

  res.status(500).json({
    sucesso: false,
    mensagem: "Ocorreu um erro interno na aplicação.",
  });
});

module.exports = app;
