const express = require("express");
const { testarConexao, mensagemConexao } = require("../services/postgres");
const { validarConfiguracaoConexao } = require("../utils/validacao");

const router = express.Router();

router.post("/testar", async (req, res) => {
  const validacao = validarConfiguracaoConexao(req.body);

  if (!validacao.valido) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Revise os dados de conexão.",
      erros: validacao.erros,
    });
  }

  try {
    const resultado = await testarConexao(validacao.dados);

    return res.json({
      sucesso: true,
      mensagem: "Conexão com o PostgreSQL realizada com sucesso.",
      dados: resultado,
    });
  } catch (error) {
    console.error("Falha no teste de conexão PostgreSQL", {
      codigo: error.code || "SEM_CODIGO",
      momento: new Date().toISOString(),
    });

    return res.status(400).json({
      sucesso: false,
      mensagem: mensagemConexao(error),
    });
  }
});

module.exports = router;

