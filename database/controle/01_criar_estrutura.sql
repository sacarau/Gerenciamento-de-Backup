BEGIN;

DROP TABLE IF EXISTS log_execucao CASCADE;
DROP TABLE IF EXISTS etapa_execucao CASCADE;
DROP TABLE IF EXISTS manutencao_historico CASCADE;
DROP TABLE IF EXISTS execucao_backup CASCADE;
DROP TABLE IF EXISTS configuracao_backup CASCADE;

CREATE TABLE configuracao_backup (
    id_configuracao   BIGSERIAL PRIMARY KEY,
    nome              VARCHAR(100) NOT NULL,
    host_banco        VARCHAR(255) NOT NULL,
    porta_banco       INTEGER NOT NULL DEFAULT 5432,
    banco_alvo        VARCHAR(100) NOT NULL,
    usuario_banco     VARCHAR(100) NOT NULL,
    caminho_destino   TEXT NOT NULL,
    quantidade_manter INTEGER,
    caminho_copia     TEXT,
    opcoes             JSONB NOT NULL DEFAULT '{}'::JSONB,
    criado_em          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_configuracao_porta
        CHECK (porta_banco BETWEEN 1 AND 65535),
    CONSTRAINT ck_configuracao_quantidade
        CHECK (quantidade_manter IS NULL OR quantidade_manter > 0)
);

CREATE TABLE execucao_backup (
    id_execucao       BIGSERIAL PRIMARY KEY,
    id_configuracao   BIGINT NOT NULL,
    inicio            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim               TIMESTAMP,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    origem_decisao    VARCHAR(15),
    regra_aplicada    VARCHAR(120),
    arquivo_resultante TEXT,
    etapa_falha       VARCHAR(50),
    CONSTRAINT fk_execucao_configuracao
        FOREIGN KEY (id_configuracao)
        REFERENCES configuracao_backup (id_configuracao),
    CONSTRAINT ck_execucao_status
        CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'SUCESSO', 'FALHA', 'CANCELADA')),
    CONSTRAINT ck_execucao_origem
        CHECK (origem_decisao IS NULL OR origem_decisao IN ('AUTOMATICA', 'MANUAL')),
    CONSTRAINT ck_execucao_periodo
        CHECK (fim IS NULL OR fim >= inicio)
);

CREATE TABLE manutencao_historico (
    id_manutencao   BIGSERIAL PRIMARY KEY,
    id_execucao     BIGINT NOT NULL UNIQUE,
    tipo            VARCHAR(30) NOT NULL,
    data_referencia TIMESTAMP,
    inicio          TIMESTAMP,
    fim             TIMESTAMP,
    resultado       VARCHAR(20),
    CONSTRAINT fk_manutencao_execucao
        FOREIGN KEY (id_execucao)
        REFERENCES execucao_backup (id_execucao),
    CONSTRAINT ck_manutencao_tipo
        CHECK (tipo IN ('VACUUM', 'VACUUM_FULL_ANALYZE', 'NENHUMA')),
    CONSTRAINT ck_manutencao_resultado
        CHECK (resultado IS NULL OR resultado IN ('SUCESSO', 'FALHA', 'IGNORADA'))
);

CREATE TABLE etapa_execucao (
    id_etapa      BIGSERIAL PRIMARY KEY,
    id_execucao   BIGINT NOT NULL,
    ordem         SMALLINT NOT NULL,
    nome          VARCHAR(50) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO',
    inicio        TIMESTAMP,
    fim           TIMESTAMP,
    CONSTRAINT fk_etapa_execucao
        FOREIGN KEY (id_execucao)
        REFERENCES execucao_backup (id_execucao),
    CONSTRAINT uq_etapa_ordem
        UNIQUE (id_execucao, ordem),
    CONSTRAINT ck_etapa_status
        CHECK (status IN ('AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDA', 'IGNORADA', 'FALHA'))
);

CREATE TABLE log_execucao (
    id_log              BIGSERIAL PRIMARY KEY,
    id_execucao         BIGINT NOT NULL,
    data_hora           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nivel               VARCHAR(10) NOT NULL,
    etapa               VARCHAR(50),
    mensagem            TEXT NOT NULL,
    detalhes_sanitizados TEXT,
    CONSTRAINT fk_log_execucao
        FOREIGN KEY (id_execucao)
        REFERENCES execucao_backup (id_execucao),
    CONSTRAINT ck_log_nivel
        CHECK (nivel IN ('INFO', 'AVISO', 'ERRO'))
);

CREATE INDEX idx_execucao_inicio
    ON execucao_backup (inicio DESC);

CREATE INDEX idx_execucao_status
    ON execucao_backup (status);

CREATE INDEX idx_etapa_execucao
    ON etapa_execucao (id_execucao, ordem);

CREATE INDEX idx_log_execucao_data
    ON log_execucao (id_execucao, data_hora);

COMMIT;

