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
    mensagem TEXT,
    criptografado BOOLEAN NOT NULL DEFAULT FALSE,
    compactado BOOLEAN NOT NULL DEFAULT FALSE,
    copia_adicional TEXT,
    log_execucao TEXT,
    arquivo_log TEXT,
    email_log_simulado TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_historico_execucao_fim
    ON backup_manager.historico_execucao (fim DESC);

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

