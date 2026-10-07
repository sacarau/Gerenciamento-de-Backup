BEGIN;

DROP TABLE IF EXISTS partida CASCADE;
DROP TABLE IF EXISTS clube_campeonato CASCADE;
DROP TABLE IF EXISTS jogador CASCADE;
DROP TABLE IF EXISTS campeonato CASCADE;
DROP TABLE IF EXISTS clube CASCADE;

CREATE TABLE clube (
    id_clube       BIGSERIAL PRIMARY KEY,
    nome           VARCHAR(120) NOT NULL UNIQUE,
    sigla          VARCHAR(10) NOT NULL UNIQUE,
    cidade         VARCHAR(100) NOT NULL,
    estado         CHAR(2) NOT NULL,
    data_fundacao  DATE NOT NULL,
    CONSTRAINT ck_clube_estado
        CHECK (estado ~ '^[A-Z]{2}$')
);

CREATE TABLE jogador (
    id_jogador       BIGSERIAL PRIMARY KEY,
    id_clube         BIGINT NOT NULL,
    nome             VARCHAR(120) NOT NULL,
    posicao          VARCHAR(30) NOT NULL,
    numero_camisa    SMALLINT NOT NULL,
    data_nascimento  DATE NOT NULL,
    ativo            BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_jogador_clube
        FOREIGN KEY (id_clube) REFERENCES clube (id_clube),
    CONSTRAINT uq_jogador_camisa_clube
        UNIQUE (id_clube, numero_camisa),
    CONSTRAINT ck_jogador_posicao
        CHECK (posicao IN ('Goleiro', 'Zagueiro', 'Lateral', 'Meio-campo', 'Atacante')),
    CONSTRAINT ck_jogador_numero_camisa
        CHECK (numero_camisa BETWEEN 1 AND 99)
);

CREATE TABLE campeonato (
    id_campeonato  BIGSERIAL PRIMARY KEY,
    nome           VARCHAR(120) NOT NULL,
    temporada      SMALLINT NOT NULL,
    data_inicio    DATE NOT NULL,
    data_fim       DATE NOT NULL,
    CONSTRAINT uq_campeonato_nome_temporada
        UNIQUE (nome, temporada),
    CONSTRAINT ck_campeonato_temporada
        CHECK (temporada BETWEEN 2000 AND 2100),
    CONSTRAINT ck_campeonato_periodo
        CHECK (data_fim >= data_inicio)
);

CREATE TABLE clube_campeonato (
    id_clube       BIGINT NOT NULL,
    id_campeonato  BIGINT NOT NULL,
    pontos         INTEGER NOT NULL DEFAULT 0,
    jogos          INTEGER NOT NULL DEFAULT 0,
    vitorias       INTEGER NOT NULL DEFAULT 0,
    empates        INTEGER NOT NULL DEFAULT 0,
    derrotas       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id_clube, id_campeonato),
    CONSTRAINT fk_clube_campeonato_clube
        FOREIGN KEY (id_clube) REFERENCES clube (id_clube),
    CONSTRAINT fk_clube_campeonato_campeonato
        FOREIGN KEY (id_campeonato) REFERENCES campeonato (id_campeonato),
    CONSTRAINT ck_clube_campeonato_valores
        CHECK (
            pontos >= 0 AND jogos >= 0 AND vitorias >= 0
            AND empates >= 0 AND derrotas >= 0
        ),
    CONSTRAINT ck_clube_campeonato_total_jogos
        CHECK (vitorias + empates + derrotas <= jogos),
    CONSTRAINT ck_clube_campeonato_pontos
        CHECK (pontos = (vitorias * 3) + empates)
);

CREATE TABLE partida (
    id_partida      BIGSERIAL PRIMARY KEY,
    id_campeonato   BIGINT NOT NULL,
    id_mandante     BIGINT NOT NULL,
    id_visitante    BIGINT NOT NULL,
    data_hora       TIMESTAMP NOT NULL,
    estadio         VARCHAR(120) NOT NULL,
    gols_mandante   SMALLINT,
    gols_visitante  SMALLINT,
    status           VARCHAR(20) NOT NULL,
    CONSTRAINT fk_partida_campeonato
        FOREIGN KEY (id_campeonato) REFERENCES campeonato (id_campeonato),
    CONSTRAINT fk_partida_mandante
        FOREIGN KEY (id_mandante) REFERENCES clube (id_clube),
    CONSTRAINT fk_partida_visitante
        FOREIGN KEY (id_visitante) REFERENCES clube (id_clube),
    CONSTRAINT ck_partida_clubes_diferentes
        CHECK (id_mandante <> id_visitante),
    CONSTRAINT ck_partida_status
        CHECK (status IN ('AGENDADA', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA')),
    CONSTRAINT ck_partida_gols
        CHECK (
            (gols_mandante IS NULL OR gols_mandante >= 0)
            AND (gols_visitante IS NULL OR gols_visitante >= 0)
        ),
    CONSTRAINT ck_partida_placar_status
        CHECK (
            (status = 'ENCERRADA' AND gols_mandante IS NOT NULL AND gols_visitante IS NOT NULL)
            OR
            (status <> 'ENCERRADA' AND gols_mandante IS NULL AND gols_visitante IS NULL)
        )
);

CREATE INDEX idx_jogador_id_clube
    ON jogador (id_clube);

CREATE INDEX idx_partida_data_hora
    ON partida (data_hora);

CREATE INDEX idx_partida_id_campeonato
    ON partida (id_campeonato);

CREATE INDEX idx_partida_id_mandante
    ON partida (id_mandante);

CREATE INDEX idx_partida_id_visitante
    ON partida (id_visitante);

COMMIT;

