const { randomUUID } = require("node:crypto");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { resolverPgRestore } = require("./backup");
const {
  descriptografarArquivo,
  extrairZipProtegido,
} = require("./protecao");
const {
  finalizarHistoricoRestauracao,
  garantirBancoRestauracao,
  garantirEstruturaHistorico,
  iniciarHistoricoRestauracao,
  testarConexao,
} = require("./postgres");

const restauracoes = new Map();
const TEMPO_RETENCAO_STATUS_MS = 60 * 60 * 1000;
const ETAPAS = [
  { id: "validacao", nome: "Validação do arquivo e da conexão" },
  { id: "preparacao", nome: "Descompactação e descriptografia" },
  { id: "restauracao", nome: "Restauração com pg_restore" },
  { id: "verificacao", nome: "Conferência da integridade dos dados" },
  { id: "finalizacao", nome: "Registro do resultado" },
];

class RestauracaoEmAndamentoError extends Error {}

function agora() {
  return new Date().toISOString();
}

function erroPublico(mensagem, causa) {
  const error = new Error(mensagem, { cause: causa });
  error.mensagemPublica = mensagem;
  return error;
}

function criarEstado(id, parametros) {
  return {
    id,
    status: "EM_ANDAMENTO",
    progresso: 0,
    etapaAtual: "validacao",
    iniciadoEm: agora(),
    atualizadoEm: agora(),
    finalizadoEm: null,
    etapas: ETAPAS.map((etapa) => ({ ...etapa, status: "AGUARDANDO", detalhe: "Aguardando" })),
    logs: [],
    resultado: {
      historicoId: null,
      arquivoOrigem: parametros.arquivoBackup,
      bancoDestino: parametros.bancoDestino,
      bancoCriado: false,
      totalTabelas: null,
      totalRegistros: null,
      tabelas: [],
    },
    mensagem: "Restauração recebida.",
  };
}

function registrarLog(estado, mensagem, nivel = "INFO") {
  estado.logs.push({ momento: agora(), nivel, mensagem });
  estado.atualizadoEm = agora();
}

function atualizarEtapa(estado, id, status, detalhe, progresso) {
  const etapa = estado.etapas.find((item) => item.id === id);
  if (etapa) {
    etapa.status = status;
    etapa.detalhe = detalhe;
  }
  estado.etapaAtual = id;
  estado.progresso = progresso;
  estado.mensagem = detalhe;
  estado.atualizadoEm = agora();
}

function marcarFalha(estado, mensagem) {
  const etapa = estado.etapas.find((item) => item.status === "EM_ANDAMENTO");
  if (etapa) {
    etapa.status = "FALHA";
    etapa.detalhe = mensagem;
  }
  estado.status = "FALHA";
  estado.mensagem = mensagem;
  estado.finalizadoEm = agora();
  estado.atualizadoEm = agora();
  registrarLog(estado, mensagem, "ERRO");
}

function mensagemErro(error) {
  if (error.mensagemPublica) {
    return error.mensagemPublica;
  }
  const mensagens = {
    "42501": "O usuário PostgreSQL não possui permissão para criar ou restaurar o banco.",
    EACCES: "A aplicação não possui permissão para acessar o arquivo informado.",
    ENOENT: "O arquivo de backup ou o pg_restore não foi encontrado.",
    ENOSPC: "Não há espaço disponível para preparar a restauração.",
  };
  return mensagens[error.code]
    || "A restauração não pôde ser concluída. Consulte o log para mais detalhes.";
}

function executarPgRestore(executavel, argumentos, ambiente) {
  return new Promise((resolve, reject) => {
    const processo = spawn(executavel, argumentos, {
      env: ambiente,
      shell: false,
      windowsHide: true,
    });
    let stderr = "";

    processo.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 16000) {
        stderr = stderr.slice(-16000);
      }
    });
    processo.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(erroPublico(
          "O pg_restore não foi localizado. Informe seu caminho na tela de restauração.",
          error,
        ));
        return;
      }
      reject(erroPublico("Não foi possível iniciar o pg_restore.", error));
    });
    processo.on("close", (codigo) => {
      if (codigo === 0) {
        resolve();
        return;
      }
      const detalhe = stderr.trim().replace(/\s+/g, " ").slice(-1000);
      const complemento = detalhe ? " Detalhe: " + detalhe : "";
      reject(erroPublico("O pg_restore terminou com código " + codigo + "." + complemento));
    });
  });
}

async function prepararArquivo(parametros, temporario, estado) {
  let arquivo = path.resolve(parametros.arquivoBackup);
  const informacoes = await fsp.stat(arquivo);
  if (!informacoes.isFile() || informacoes.size === 0) {
    throw erroPublico("O arquivo de backup está vazio ou não é um arquivo regular.");
  }

  if (/\.zip$/i.test(arquivo)) {
    registrarLog(estado, "Extraindo o ZIP protegido; a senha não será registrada.");
    const extraido = await extrairZipProtegido(arquivo, parametros.senhaZip, temporario);
    arquivo = extraido.arquivo;
    registrarLog(estado, "ZIP extraído em diretório temporário.");
  }

  if (/\.aes$/i.test(arquivo)) {
    if (parametros.chaveCriptografia.length < 8) {
      throw erroPublico("O conteúdo do backup está criptografado. Informe a chave AES.");
    }
    registrarLog(estado, "Descriptografando o backup AES; a chave não será registrada.");
    const descriptografado = path.join(temporario, "restauracao.backup");
    await descriptografarArquivo(arquivo, parametros.chaveCriptografia, descriptografado);
    arquivo = descriptografado;
    registrarLog(estado, "Backup descriptografado em diretório temporário.");
  }

  if (!/\.backup$/i.test(arquivo)) {
    throw erroPublico("O conteúdo preparado não possui o formato .backup esperado.");
  }
  return arquivo;
}

async function executarRestauracao(id, configuracao, parametros) {
  const estado = restauracoes.get(id);
  let historicoId = null;
  let temporario = null;

  try {
    atualizarEtapa(estado, "validacao", "EM_ANDAMENTO", "Validando origem e conexão.", 5);
    registrarLog(estado, "Início da validação da restauração.");
    await testarConexao(configuracao);
    await garantirEstruturaHistorico(configuracao);
    await fsp.access(path.resolve(parametros.arquivoBackup));
    historicoId = await iniciarHistoricoRestauracao(configuracao, {
      arquivoOrigem: path.resolve(parametros.arquivoBackup),
      bancoDestino: parametros.bancoDestino,
    });
    estado.resultado.historicoId = historicoId;
    atualizarEtapa(estado, "validacao", "CONCLUIDA", "Arquivo e conexão validados.", 20);

    atualizarEtapa(estado, "preparacao", "EM_ANDAMENTO", "Preparando o arquivo para restauração.", 25);
    temporario = await fsp.mkdtemp(path.join(os.tmpdir(), "gerenciamento-backup-restore-"));
    const arquivoPreparado = await prepararArquivo(parametros, temporario, estado);
    atualizarEtapa(estado, "preparacao", "CONCLUIDA", "Arquivo preparado com segurança.", 45);

    atualizarEtapa(estado, "restauracao", "EM_ANDAMENTO", "Criando destino e executando pg_restore.", 50);
    const banco = await garantirBancoRestauracao(configuracao, parametros.bancoDestino);
    estado.resultado.bancoCriado = banco.criado;
    registrarLog(
      estado,
      banco.criado
        ? "Banco de destino criado pela plataforma."
        : "Banco de destino existente; os objetos do backup serão recriados.",
    );
    const executavel = await resolverPgRestore(parametros.caminhoPgRestore);
    await executarPgRestore(executavel, [
      "--host", configuracao.host,
      "--port", String(configuracao.porta),
      "--username", configuracao.usuario,
      "--dbname", parametros.bancoDestino,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      arquivoPreparado,
    ], { ...process.env, PGPASSWORD: configuracao.senha });
    atualizarEtapa(estado, "restauracao", "CONCLUIDA", "pg_restore concluído.", 80);
    registrarLog(estado, "Restauração executada com sucesso pelo pg_restore.");

    atualizarEtapa(estado, "verificacao", "EM_ANDAMENTO", "Conferindo tabelas e registros restaurados.", 85);
    const conferencia = await testarConexao({ ...configuracao, banco: parametros.bancoDestino });
    estado.resultado.totalTabelas = conferencia.totalTabelas;
    estado.resultado.totalRegistros = conferencia.totalRegistros;
    estado.resultado.tabelas = conferencia.tabelas;
    atualizarEtapa(
      estado,
      "verificacao",
      "CONCLUIDA",
      conferencia.totalTabelas + " tabela(s) e " + conferencia.totalRegistros + " registro(s) conferidos.",
      95,
    );
    registrarLog(
      estado,
      "Integridade conferida: " + conferencia.totalTabelas + " tabela(s) pública(s), "
        + conferencia.totalRegistros + " registro(s).",
      "SUCESSO",
    );

    atualizarEtapa(estado, "finalizacao", "EM_ANDAMENTO", "Registrando o resultado.", 97);
    await finalizarHistoricoRestauracao(configuracao, historicoId, {
      resultado: "SUCESSO",
      totalTabelas: conferencia.totalTabelas,
      totalRegistros: conferencia.totalRegistros,
      mensagem: "Restauração e conferência concluídas pela aplicação web.",
    });
    atualizarEtapa(estado, "finalizacao", "CONCLUIDA", "Restauração registrada.", 100);
    estado.status = "SUCESSO";
    estado.mensagem = "Restauração concluída e dados conferidos.";
    estado.finalizadoEm = agora();
    registrarLog(estado, "Processo de restauração finalizado com sucesso.", "SUCESSO");
  } catch (error) {
    const mensagem = mensagemErro(error);
    marcarFalha(estado, mensagem);
    if (historicoId !== null) {
      await finalizarHistoricoRestauracao(configuracao, historicoId, {
        resultado: "FALHA",
        mensagem,
      }).catch(() => undefined);
    }
    console.error("Falha no processo de restauração", {
      processoId: id,
      codigo: error.code || "SEM_CODIGO",
      nome: error.name,
      momento: agora(),
    });
  } finally {
    if (temporario) {
      await fsp.rm(temporario, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function removerRestauracoesAntigas() {
  const limite = Date.now() - TEMPO_RETENCAO_STATUS_MS;
  for (const [id, estado] of restauracoes) {
    if (estado.finalizadoEm && new Date(estado.finalizadoEm).getTime() < limite) {
      restauracoes.delete(id);
    }
  }
}

function criarRestauracao(configuracao, parametros) {
  removerRestauracoesAntigas();
  const existeAtiva = Array.from(restauracoes.values())
    .some((estado) => estado.status === "EM_ANDAMENTO");
  if (existeAtiva) {
    throw new RestauracaoEmAndamentoError("Já existe uma restauração em andamento.");
  }

  const id = randomUUID();
  const estado = criarEstado(id, parametros);
  restauracoes.set(id, estado);
  setImmediate(() => executarRestauracao(id, configuracao, parametros));
  return estado;
}

function obterRestauracao(id) {
  removerRestauracoesAntigas();
  return restauracoes.get(id) || null;
}

module.exports = {
  RestauracaoEmAndamentoError,
  criarRestauracao,
  obterRestauracao,
};
