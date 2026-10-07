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
