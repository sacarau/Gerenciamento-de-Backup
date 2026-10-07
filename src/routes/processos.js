const express = require("express");
const {
  ProcessoEmAndamentoError,
  criarProcesso,
  obterProcesso,
} = require("../services/processos");
const {
  validarConfiguracaoConexao,
  validarParametrosProcesso,
} = require("../utils/validacao");

const router = express.Router();
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.post("/", (req, res) => {
  const validacaoConexao = validarConfiguracaoConexao(req.body.conexao);
  const validacaoParametros = validarParametrosProcesso(req.body.parametros);
  const erros = [...validacaoConexao.erros, ...validacaoParametros.erros];

  if (erros.length > 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Revise a configuração antes de iniciar.",
      erros,
    });
  }

  try {
    const processo = criarProcesso(validacaoConexao.dados, validacaoParametros.dados);
    return res.status(202).json({
      sucesso: true,
      mensagem: "Processo iniciado.",
      dados: processo,
    });
  } catch (error) {
    if (error instanceof ProcessoEmAndamentoError) {
      return res.status(409).json({
        sucesso: false,
        mensagem: error.message,
      });
    }

    throw error;
  }
});

router.get("/:id", (req, res) => {
  if (!UUID_VALIDO.test(req.params.id)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Identificador de processo inválido.",
    });
  }

  const processo = obterProcesso(req.params.id);
  if (!processo) {
    return res.status(404).json({
      sucesso: false,
      mensagem: "Processo não encontrado ou já removido da memória.",
    });
  }

  return res.json({
    sucesso: true,
    dados: processo,
  });
});

module.exports = router;
