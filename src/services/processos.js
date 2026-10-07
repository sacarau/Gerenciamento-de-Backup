const { randomUUID } = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  aplicarRetencao,
  copiarBackup,
  gerarBackup,
} = require("./backup");
const {
  compactarArquivoProtegido,
  criptografarArquivo,
} = require("./protecao");
const {
  salvarLogExecucao,
  simularEnvioEmailLog,
} = require("./logs");
const {
  buscarUltimaManutencao,
  executarManutencao,
  finalizarHistorico,
  garantirEstruturaHistorico,
  iniciarHistorico,
  testarConexao,
} = require("./postgres");
const { ACOES, decidirManutencao, modoParaHistorico } = require("./regras");

const processos = new Map();
const TEMPO_RETENCAO_STATUS_MS = 60 * 60 * 1000;

const ETAPAS = [
  { id: "validacao", nome: "Validação da conexão e dos parâmetros" },
  { id: "decisao", nome: "Decisão de manutenção" },
  { id: "manutencao", nome: "Execução da manutenção" },
  { id: "backup", nome: "Geração do backup" },
  { id: "criptografia", nome: "Criptografia AES" },
  { id: "compactacao", nome: "Compactação ZIP protegida" },
  { id: "finalizacao", nome: "Retenção, cópia e histórico" },
];

class ProcessoEmAndamentoError extends Error {}

function agora() {
  return new Date().toISOString();
}

function criarEstado(id) {
  return {
    id,
    status: "EM_ANDAMENTO",
    progresso: 0,
    etapaAtual: "validacao",
    iniciadoEm: agora(),
    atualizadoEm: agora(),
    finalizadoEm: null,
    etapas: ETAPAS.map((etapa) => ({
      ...etapa,
      status: "AGUARDANDO",
      detalhe: "Aguardando",
    })),
    logs: [],
    resultado: {
      historicoId: null,
      decisao: null,
      backup: null,
      arquivoFinal: null,
      criptografia: null,
      compactacao: null,
      copiaAdicional: null,
      arquivosRemovidos: [],
      arquivoLog: null,
      emailLogSimulado: null,
    },
    mensagem: "Processo recebido.",
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

function mensagemErro(error) {
  if (error.mensagemPublica) {
    return error.mensagemPublica;
  }

  const mensagens = {
    "28P01": "Usuário ou senha do PostgreSQL inválidos.",
    "28000": "O usuário não possui autorização para acessar o PostgreSQL.",
    "3D000": "O banco de dados informado não existe.",
    "42501": "O usuário não possui permissão para executar uma das operações.",
    ECONNREFUSED: "Não foi possível alcançar o PostgreSQL.",
    ENOTFOUND: "O servidor PostgreSQL não foi encontrado.",
    ETIMEDOUT: "O PostgreSQL demorou demais para responder.",
    EACCES: "A aplicação não possui permissão para acessar um dos caminhos informados.",
    ENOSPC: "Não há espaço disponível para gerar o backup.",
  };

  return mensagens[error.code]
    || "A execução não pôde ser concluída. Consulte o terminal do servidor para mais detalhes.";
}

function erroPublico(mensagem) {
  const error = new Error(mensagem);
  error.mensagemPublica = mensagem;
  return error;
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

async function executarProcesso(id, configuracao, parametros) {
  const estado = processos.get(id);
  let historicoId = null;
  let manutencaoExecutada = false;
  let arquivoBackup = null;
  let copiaAdicional = null;

  try {
    atualizarEtapa(estado, "validacao", "EM_ANDAMENTO", "Validando a conexão com o PostgreSQL.", 5);
    registrarLog(estado, "Início da validação da conexão e dos parâmetros.");
    const conexao = await testarConexao(configuracao);
    registrarLog(
      estado,
      "Conexão validada: " + conexao.totalTabelas + " tabela(s) pública(s) encontrada(s).",
    );
    await garantirEstruturaHistorico(configuracao);
    atualizarEtapa(estado, "validacao", "CONCLUIDA", "Conexão e estrutura de histórico validadas.", 20);

    atualizarEtapa(estado, "decisao", "EM_ANDAMENTO", "Consultando a última manutenção registrada.", 25);
    const ultimaManutencao = await buscarUltimaManutencao(configuracao);
    const dias = ultimaManutencao ? ultimaManutencao.dias : null;
    const decisao = decidirManutencao(parametros.modoManutencao, dias);
    estado.resultado.decisao = decisao;
    registrarLog(estado, decisao.regra);

    historicoId = await iniciarHistorico(configuracao, {
      modo: modoParaHistorico(parametros.modoManutencao),
      diasDesdeUltimaManutencao: dias,
      regra: decisao.regra,
      acao: decisao.acao,
    });
    estado.resultado.historicoId = historicoId;
    atualizarEtapa(estado, "decisao", "CONCLUIDA", "Ação definida: " + decisao.acao + ".", 40);

    if (decisao.acao === ACOES.NENHUMA) {
      atualizarEtapa(estado, "manutencao", "IGNORADA", "Nenhuma manutenção foi necessária.", 55);
      registrarLog(estado, "Etapa de manutenção ignorada conforme a regra selecionada.");
    } else {
      atualizarEtapa(estado, "manutencao", "EM_ANDAMENTO", "Executando " + decisao.acao + ".", 45);
      registrarLog(estado, "Executando manutenção: " + decisao.acao + ".");
      await executarManutencao(configuracao, decisao.acao);
      manutencaoExecutada = true;
      atualizarEtapa(estado, "manutencao", "CONCLUIDA", decisao.acao + " concluído.", 60);
      registrarLog(estado, "Manutenção concluída com sucesso.");
    }

    atualizarEtapa(estado, "backup", "EM_ANDAMENTO", "Gerando o arquivo de backup.", 62);
    if (parametros.simularFalha) {
      registrarLog(
        estado,
        "Falha controlada acionada antes do pg_dump; etapas dependentes serão interrompidas.",
        "AVISO",
      );
      throw erroPublico("Falha controlada de demonstração na etapa de backup.");
    }

    const backup = await gerarBackup(configuracao, parametros, (mensagem) => registrarLog(estado, mensagem));
    arquivoBackup = backup.arquivo;
    estado.resultado.backup = backup;
    estado.resultado.arquivoFinal = arquivoBackup;
    atualizarEtapa(estado, "backup", "CONCLUIDA", "Arquivo de backup gerado.", 68);
    registrarLog(estado, "Backup gerado em " + backup.arquivo + ".");

    if (parametros.criptografar) {
      atualizarEtapa(
        estado,
        "criptografia",
        "EM_ANDAMENTO",
        "Protegendo o backup com AES-256-GCM.",
        70,
      );
      registrarLog(estado, "Criptografia AES-256-GCM iniciada; a chave não será registrada.");
      const criptografado = await criptografarArquivo(
        arquivoBackup,
        parametros.chaveCriptografia,
      );
      await fsp.rm(arquivoBackup, { force: true });
      arquivoBackup = criptografado.arquivo;
      estado.resultado.criptografia = criptografado;
      estado.resultado.arquivoFinal = arquivoBackup;
      atualizarEtapa(
        estado,
        "criptografia",
        "CONCLUIDA",
        "Backup criptografado com AES-256-GCM.",
        76,
      );
      registrarLog(estado, "Criptografia AES concluída; o arquivo temporário sem proteção foi removido.");
    } else {
      atualizarEtapa(
        estado,
        "criptografia",
        "IGNORADA",
        "Criptografia não solicitada.",
        76,
      );
      registrarLog(estado, "Etapa de criptografia não solicitada.");
    }

    if (parametros.compactar) {
      atualizarEtapa(
        estado,
        "compactacao",
        "EM_ANDAMENTO",
        "Gerando ZIP protegido por senha.",
        78,
      );
      registrarLog(estado, "Compactação ZIP AES-256 iniciada; a senha não será registrada.");
      const compactado = await compactarArquivoProtegido(arquivoBackup, parametros.senhaZip);
      await fsp.rm(arquivoBackup, { force: true });
      arquivoBackup = compactado.arquivo;
      estado.resultado.compactacao = compactado;
      estado.resultado.arquivoFinal = arquivoBackup;
      atualizarEtapa(
        estado,
        "compactacao",
        "CONCLUIDA",
        "ZIP protegido por senha gerado.",
        85,
      );
      registrarLog(estado, "Compactação concluída; o arquivo intermediário foi removido.");
    } else {
      atualizarEtapa(
        estado,
        "compactacao",
        "IGNORADA",
        "Compactação não solicitada.",
        85,
      );
      registrarLog(estado, "Etapa de compactação não solicitada.");
    }

    atualizarEtapa(estado, "finalizacao", "EM_ANDAMENTO", "Aplicando retenção e cópia adicional.", 88);
    const removidos = await aplicarRetencao(
      path.dirname(arquivoBackup),
      configuracao.banco,
      parametros.quantidadeManter,
    );
    estado.resultado.arquivosRemovidos = removidos;
    registrarLog(
      estado,
      removidos.length === 0
        ? "Nenhum backup antigo precisou ser removido."
        : removidos.length + " backup(s) antigo(s) removido(s) pela retenção.",
    );

    copiaAdicional = await copiarBackup(arquivoBackup, parametros.destinoAdicional);
    estado.resultado.copiaAdicional = copiaAdicional;
    if (copiaAdicional) {
      registrarLog(estado, "Cópia adicional criada em " + copiaAdicional + ".");
    }

    estado.finalizadoEm = agora();
    registrarLog(estado, "Processo finalizado com sucesso.", "SUCESSO");
    const logPersistido = await salvarLogExecucao(id, estado.logs, "SUCESSO");
    estado.resultado.arquivoLog = logPersistido.arquivo;
    await finalizarHistorico(configuracao, historicoId, {
      manutencaoExecutada,
      arquivoBackup,
      resultado: "SUCESSO",
      mensagem: "Manutenção e backup concluídos pela aplicação web.",
      criptografado: Boolean(estado.resultado.criptografia),
      compactado: Boolean(estado.resultado.compactacao),
      copiaAdicional,
      logExecucao: logPersistido.conteudo,
      arquivoLog: logPersistido.arquivo,
    });
    atualizarEtapa(estado, "finalizacao", "CONCLUIDA", "Retenção, cópia e histórico concluídos.", 100);
    estado.status = "SUCESSO";
    estado.mensagem = "Processo concluído com sucesso.";
  } catch (error) {
    const mensagem = mensagemErro(error);
    marcarFalha(estado, mensagem);

    let logPersistido = null;
    let emailLogSimulado = null;
    try {
      logPersistido = await salvarLogExecucao(id, estado.logs, "FALHA");
      estado.resultado.arquivoLog = logPersistido.arquivo;
      emailLogSimulado = await simularEnvioEmailLog({
        id,
        destinatario: parametros.emailFalha,
        arquivoLog: logPersistido.arquivo,
        conteudoLog: logPersistido.conteudo,
      });
      estado.resultado.emailLogSimulado = emailLogSimulado;
      registrarLog(
        estado,
        "Envio do log simulado em arquivo .eml para " + parametros.emailFalha + ".",
        "INFO",
      );
    } catch (logError) {
      registrarLog(estado, "Não foi possível persistir ou simular o envio do log de falha.", "ERRO");
    }

    if (historicoId !== null) {
      await finalizarHistorico(configuracao, historicoId, {
        manutencaoExecutada,
        arquivoBackup,
        resultado: "FALHA",
        mensagem,
        criptografado: Boolean(estado.resultado.criptografia),
        compactado: Boolean(estado.resultado.compactacao),
        copiaAdicional,
        logExecucao: logPersistido ? logPersistido.conteudo : null,
        arquivoLog: logPersistido ? logPersistido.arquivo : null,
        emailLogSimulado,
      }).catch(() => undefined);
    }

    console.error("Falha no processo de manutenção e backup", {
      processoId: id,
      codigo: error.code || "SEM_CODIGO",
      nome: error.name,
      momento: agora(),
    });
  }
}

function removerProcessosAntigos() {
  const limite = Date.now() - TEMPO_RETENCAO_STATUS_MS;

  for (const [id, estado] of processos) {
    if (estado.finalizadoEm && new Date(estado.finalizadoEm).getTime() < limite) {
      processos.delete(id);
    }
  }
}

function criarProcesso(configuracao, parametros) {
  removerProcessosAntigos();
  const existeAtivo = Array.from(processos.values())
    .some((estado) => estado.status === "EM_ANDAMENTO");

  if (existeAtivo) {
    throw new ProcessoEmAndamentoError("Já existe um processo em andamento.");
  }

  const id = randomUUID();
  const estado = criarEstado(id);
  processos.set(id, estado);

  setImmediate(() => executarProcesso(id, configuracao, parametros));
  return estado;
}

function obterProcesso(id) {
  removerProcessosAntigos();
  return processos.get(id) || null;
}

module.exports = {
  ProcessoEmAndamentoError,
  criarProcesso,
  obterProcesso,
};
