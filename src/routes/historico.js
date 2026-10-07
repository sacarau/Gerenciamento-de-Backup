const express = require("express");
const {
  garantirEstruturaHistorico,
  listarHistorico,
  mensagemConexao,
  obterLogHistorico,
} = require("../services/postgres");
const { validarConfiguracaoConexao } = require("../utils/validacao");

const router = express.Router();

router.post("/listar", async (req, res) => {
  const validacao = validarConfiguracaoConexao(req.body.conexao);

  if (!validacao.valido) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Revise os dados de conexão para consultar o histórico.",
      erros: validacao.erros,
    });
  }

  try {
    await garantirEstruturaHistorico(validacao.dados);
    const registros = await listarHistorico(validacao.dados, req.body.limite);
    return res.json({
      sucesso: true,
      mensagem: registros.length + " registro(s) encontrado(s).",
      dados: registros,
    });
  } catch (error) {
    console.error("Falha ao consultar o histórico", {
      codigo: error.code || "SEM_CODIGO",
      momento: new Date().toISOString(),
    });
    return res.status(400).json({
      sucesso: false,
      mensagem: mensagemConexao(error),
    });
  }
});

router.post("/log", async (req, res) => {
  const validacao = validarConfiguracaoConexao(req.body.conexao);
  const id = Number(req.body.id);

  if (!validacao.valido || !Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Informe uma conexão válida e o identificador do histórico.",
      erros: validacao.erros,
    });
  }

  try {
    await garantirEstruturaHistorico(validacao.dados);
    const log = await obterLogHistorico(validacao.dados, id);
    if (!log) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Registro de histórico não encontrado.",
      });
    }
    return res.json({
      sucesso: true,
      mensagem: "Log da execução carregado.",
      dados: log,
    });
  } catch (error) {
    return res.status(400).json({
      sucesso: false,
      mensagem: mensagemConexao(error),
    });
  }
});

module.exports = router;
