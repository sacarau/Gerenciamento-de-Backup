const express = require("express");
const {
  RestauracaoEmAndamentoError,
  criarRestauracao,
  obterRestauracao,
} = require("../services/restauracoes");
const {
  validarConfiguracaoConexao,
  validarParametrosRestauracao,
} = require("../utils/validacao");

const router = express.Router();
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.post("/", (req, res) => {
  const validacaoConexao = validarConfiguracaoConexao(req.body.conexao);
  const bancoOrigem = validacaoConexao.dados.banco;
  const validacaoParametros = validarParametrosRestauracao(req.body.parametros, bancoOrigem);
  const erros = [...validacaoConexao.erros, ...validacaoParametros.erros];

  if (erros.length > 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Revise os dados antes de iniciar a restauração.",
      erros,
    });
  }

  try {
    const restauracao = criarRestauracao(validacaoConexao.dados, validacaoParametros.dados);
    return res.status(202).json({
      sucesso: true,
      mensagem: "Restauração iniciada.",
      dados: restauracao,
    });
  } catch (error) {
    if (error instanceof RestauracaoEmAndamentoError) {
      return res.status(409).json({ sucesso: false, mensagem: error.message });
    }
    throw error;
  }
});

router.get("/:id", (req, res) => {
  if (!UUID_VALIDO.test(req.params.id)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Identificador de restauração inválido.",
    });
  }

  const restauracao = obterRestauracao(req.params.id);
  if (!restauracao) {
    return res.status(404).json({
      sucesso: false,
      mensagem: "Restauração não encontrada ou já removida da memória.",
    });
  }

  return res.json({ sucesso: true, dados: restauracao });
});

module.exports = router;
