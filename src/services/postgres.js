const { Client } = require("pg");
const { ACOES } = require("./regras");

const SQL_ESTRUTURA_HISTORICO = `
  CREATE SCHEMA IF NOT EXISTS backup_manager;

  CREATE TABLE IF NOT EXISTS backup_manager.historico_execucao (
    id BIGSERIAL PRIMARY KEY,
    inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim TIMESTAMP,
    modo VARCHAR(20) NOT NULL,
    dias_desde_ultima_manutencao INTEGER,
    regra VARCHAR(300) NOT NULL,
    acao_manutencao VARCHAR(40) NOT NULL,
    manutencao_executada BOOLEAN NOT NULL DEFAULT FALSE,
    arquivo_backup TEXT,
    resultado VARCHAR(20) NOT NULL,
    mensagem TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_historico_execucao_fim
    ON backup_manager.historico_execucao (fim DESC);

  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS criptografado BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS compactado BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS copia_adicional TEXT;
  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS log_execucao TEXT;
  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS arquivo_log TEXT;
  ALTER TABLE backup_manager.historico_execucao
    ADD COLUMN IF NOT EXISTS email_log_simulado TEXT;

  CREATE TABLE IF NOT EXISTS backup_manager.historico_restauracao (
    id BIGSERIAL PRIMARY KEY,
    inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim TIMESTAMP,
    arquivo_origem TEXT NOT NULL,
    banco_destino VARCHAR(63) NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    total_tabelas INTEGER,
    total_registros BIGINT,
    mensagem TEXT
  );
`;

function criarCliente(configuracao, opcoes = {}) {
  return new Client({
    host: configuracao.host,
    port: configuracao.porta,
    database: configuracao.banco,
    user: configuracao.usuario,
    password: configuracao.senha,
    application_name: "plataforma_gerenciamento_backup",
    connectionTimeoutMillis: opcoes.connectionTimeoutMillis || 5000,
    statement_timeout: opcoes.statementTimeoutMillis || 0,
  });
}

async function comCliente(configuracao, operacao, opcoes) {
  const client = criarCliente(configuracao, opcoes);

  try {
    await client.connect();
    return await operacao(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function identificadorSql(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function mensagemConexao(error) {
  const mensagens = {
    "28P01": "Usuário ou senha do PostgreSQL inválidos.",
    "28000": "O usuário informado não possui autorização para acessar o PostgreSQL.",
    "3D000": "O banco de dados informado não existe.",
    "42501": "O usuário não possui permissão suficiente para executar a operação.",
    ECONNREFUSED: "Não foi possível alcançar o PostgreSQL. Confirme se o serviço está iniciado.",
    ENOTFOUND: "O servidor informado não foi encontrado.",
    ETIMEDOUT: "O PostgreSQL demorou demais para responder.",
  };

  return mensagens[error.code] || "Não foi possível conectar ao banco com os dados informados.";
}

async function listarTabelasPublicas(client) {
  const resultado = await client.query(`
    SELECT tablename AS nome
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const tabelas = [];

  for (const linha of resultado.rows) {
    const consulta = "SELECT COUNT(*)::BIGINT AS quantidade FROM public."
      + identificadorSql(linha.nome);
    const contagem = await client.query(consulta);
    tabelas.push({
      nome: linha.nome,
      registros: Number(contagem.rows[0].quantidade),
    });
  }

  return tabelas;
}

async function testarConexao(configuracao) {
  return comCliente(configuracao, async (client) => {
    const informacoes = await client.query(`
      SELECT
        current_database() AS banco,
        current_user AS usuario,
        current_setting('server_version') AS versao_postgresql
    `);
    const tabelas = await listarTabelasPublicas(client);

    return {
      ...informacoes.rows[0],
      tabelas,
      totalTabelas: tabelas.length,
      totalRegistros: tabelas.reduce((total, tabela) => total + tabela.registros, 0),
    };
  }, { statementTimeoutMillis: 10000 });
}

async function garantirEstruturaHistorico(configuracao) {
  return comCliente(configuracao, (client) => client.query(SQL_ESTRUTURA_HISTORICO));
}

async function buscarUltimaManutencao(configuracao) {
  return comCliente(configuracao, async (client) => {
    const resultado = await client.query(`
      SELECT
        fim,
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fim)) / 86400)
        )::INTEGER AS dias
      FROM backup_manager.historico_execucao
      WHERE manutencao_executada = TRUE
        AND fim IS NOT NULL
      ORDER BY fim DESC
      LIMIT 1
    `);

    if (resultado.rowCount === 0) {
      return null;
    }

    return {
      fim: resultado.rows[0].fim,
      dias: resultado.rows[0].dias,
    };
  });
}

async function iniciarHistorico(configuracao, dados) {
  return comCliente(configuracao, async (client) => {
    const resultado = await client.query(`
      INSERT INTO backup_manager.historico_execucao (
        modo,
        dias_desde_ultima_manutencao,
        regra,
        acao_manutencao,
        resultado,
        mensagem
      ) VALUES ($1, $2, $3, $4, 'EM_ANDAMENTO', $5)
      RETURNING id
    `, [
      dados.modo,
      dados.diasDesdeUltimaManutencao,
      dados.regra,
      dados.acao,
      "Processo iniciado pela aplicação web.",
    ]);

    return resultado.rows[0].id;
  });
}

async function finalizarHistorico(configuracao, id, dados) {
  return comCliente(configuracao, (client) => client.query(`
    UPDATE backup_manager.historico_execucao
    SET fim = CURRENT_TIMESTAMP,
        manutencao_executada = $2,
        arquivo_backup = $3,
        resultado = $4,
        mensagem = $5,
        criptografado = $6,
        compactado = $7,
        copia_adicional = $8,
        log_execucao = $9,
        arquivo_log = $10,
        email_log_simulado = $11
    WHERE id = $1
  `, [
    id,
    dados.manutencaoExecutada,
    dados.arquivoBackup,
    dados.resultado,
    dados.mensagem,
    dados.criptografado === true,
    dados.compactado === true,
    dados.copiaAdicional || null,
    dados.logExecucao || null,
    dados.arquivoLog || null,
    dados.emailLogSimulado || null,
  ]));
}

async function executarManutencao(configuracao, acao) {
  if (acao === ACOES.NENHUMA) {
    return;
  }

  if (acao !== ACOES.VACUUM && acao !== ACOES.COMPLETA) {
    throw new Error("Ação de manutenção não permitida.");
  }

  await comCliente(configuracao, (client) => client.query(acao));
}

async function listarHistorico(configuracao, limite = 50) {
  const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 200);

  return comCliente(configuracao, async (client) => {
    const resultado = await client.query(`
      SELECT
        id,
        inicio,
        fim,
        CASE
          WHEN fim IS NULL THEN NULL
          ELSE ROUND(EXTRACT(EPOCH FROM (fim - inicio)))::INTEGER
        END AS duracao_segundos,
        modo,
        dias_desde_ultima_manutencao,
        regra,
        acao_manutencao,
        manutencao_executada,
        arquivo_backup,
        criptografado,
        compactado,
        copia_adicional,
        arquivo_log,
        email_log_simulado,
        resultado,
        mensagem
      FROM backup_manager.historico_execucao
      ORDER BY inicio DESC
      LIMIT $1
    `, [limiteSeguro]);

    return resultado.rows;
  });
}

async function obterLogHistorico(configuracao, id) {
  return comCliente(configuracao, async (client) => {
    const resultado = await client.query(`
      SELECT id, resultado, log_execucao, arquivo_log, email_log_simulado
      FROM backup_manager.historico_execucao
      WHERE id = $1
    `, [id]);
    return resultado.rows[0] || null;
  });
}

async function garantirBancoRestauracao(configuracao, bancoDestino) {
  const configuracaoAdministrativa = { ...configuracao, banco: "postgres" };
  return comCliente(configuracaoAdministrativa, async (client) => {
    const existente = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [bancoDestino],
    );
    if (existente.rowCount > 0) {
      return { criado: false };
    }
    await client.query("CREATE DATABASE " + identificadorSql(bancoDestino));
    return { criado: true };
  }, { statementTimeoutMillis: 30000 });
}

async function iniciarHistoricoRestauracao(configuracao, dados) {
  return comCliente(configuracao, async (client) => {
    const resultado = await client.query(`
      INSERT INTO backup_manager.historico_restauracao (
        arquivo_origem,
        banco_destino,
        resultado,
        mensagem
      ) VALUES ($1, $2, 'EM_ANDAMENTO', $3)
      RETURNING id
    `, [dados.arquivoOrigem, dados.bancoDestino, "Restauração iniciada pela aplicação web."]);
    return resultado.rows[0].id;
  });
}

async function finalizarHistoricoRestauracao(configuracao, id, dados) {
  return comCliente(configuracao, (client) => client.query(`
    UPDATE backup_manager.historico_restauracao
    SET fim = CURRENT_TIMESTAMP,
        resultado = $2,
        total_tabelas = $3,
        total_registros = $4,
        mensagem = $5
    WHERE id = $1
  `, [
    id,
    dados.resultado,
    dados.totalTabelas ?? null,
    dados.totalRegistros ?? null,
    dados.mensagem,
  ]));
}

module.exports = {
  buscarUltimaManutencao,
  executarManutencao,
  finalizarHistorico,
  finalizarHistoricoRestauracao,
  garantirBancoRestauracao,
  garantirEstruturaHistorico,
  iniciarHistorico,
  iniciarHistoricoRestauracao,
  listarHistorico,
  mensagemConexao,
  obterLogHistorico,
  testarConexao,
};
