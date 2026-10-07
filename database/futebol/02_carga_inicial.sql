BEGIN;

TRUNCATE TABLE partida, clube_campeonato, jogador, campeonato, clube
    RESTART IDENTITY CASCADE;

WITH estados AS (
    SELECT ARRAY['SC', 'RS', 'PR', 'SP', 'RJ', 'MG', 'BA', 'PE', 'GO', 'CE'] AS lista
)
INSERT INTO clube (nome, sigla, cidade, estado, data_fundacao)
SELECT
    'Clube Futebol ' || LPAD(g::TEXT, 3, '0'),
    'C' || LPAD(g::TEXT, 3, '0'),
    'Cidade ' || LPAD((((g - 1) % 40) + 1)::TEXT, 2, '0'),
    estados.lista[((g - 1) % 10) + 1],
    DATE '1910-01-01' + ((g * 157) % 40000)
FROM generate_series(1, 100) AS g
CROSS JOIN estados;

WITH posicoes AS (
    SELECT ARRAY['Goleiro', 'Zagueiro', 'Lateral', 'Meio-campo', 'Atacante'] AS lista
)
INSERT INTO jogador (
    id_clube,
    nome,
    posicao,
    numero_camisa,
    data_nascimento,
    ativo
)
SELECT
    ((g - 1) % 100) + 1,
    'Jogador ' || LPAD(g::TEXT, 5, '0'),
    posicoes.lista[((g - 1) % 5) + 1],
    (((g - 1) / 100)::INTEGER + 1)::SMALLINT,
    DATE '1987-01-01' + ((g * 37) % 6200),
    (g % 10) <> 0
FROM generate_series(1, 3000) AS g
CROSS JOIN posicoes;

WITH tipos AS (
    SELECT ARRAY[
        'Campeonato Nacional',
        'Copa Regional',
        'Liga Universitária',
        'Taça Estadual',
        'Copa dos Campeões'
    ] AS lista
), dados AS (
    SELECT
        g,
        tipos.lista[((g - 1) % 5) + 1] AS nome,
        (2023 + ((g - 1) / 5)::INTEGER)::SMALLINT AS temporada
    FROM generate_series(1, 20) AS g
    CROSS JOIN tipos
)
INSERT INTO campeonato (nome, temporada, data_inicio, data_fim)
SELECT
    nome,
    temporada,
    MAKE_DATE(temporada, 1, 15),
    MAKE_DATE(temporada, 11, 30)
FROM dados;

WITH participacoes AS (
    SELECT
        (((c.id_campeonato * 7 + serie.posicao - 1) % 100) + 1)::BIGINT AS id_clube,
        c.id_campeonato
    FROM campeonato AS c
    CROSS JOIN generate_series(0, 39) AS serie(posicao)
), desempenho AS (
    SELECT
        id_clube,
        id_campeonato,
        38 AS jogos,
        ((id_clube + id_campeonato) % 20)::INTEGER AS vitorias,
        ((id_clube * 2 + id_campeonato) % 10)::INTEGER AS empates
    FROM participacoes
)
INSERT INTO clube_campeonato (
    id_clube,
    id_campeonato,
    pontos,
    jogos,
    vitorias,
    empates,
    derrotas
)
SELECT
    id_clube,
    id_campeonato,
    (vitorias * 3) + empates,
    jogos,
    vitorias,
    empates,
    jogos - vitorias - empates
FROM desempenho;

WITH base AS (
    SELECT
        g,
        (((g - 1) % 20) + 1)::BIGINT AS id_campeonato,
        (((g * 7 - 1) % 100) + 1)::BIGINT AS id_mandante,
        TIMESTAMP '2023-01-01 12:00:00'
            + ((g % 1400) * INTERVAL '1 day')
            + ((g % 10) * INTERVAL '1 hour') AS data_hora,
        CASE
            WHEN g % 97 = 0 THEN 'CANCELADA'
            WHEN g % 10 = 0 THEN 'AGENDADA'
            ELSE 'ENCERRADA'
        END AS status
    FROM generate_series(1, 25000) AS g
), partidas AS (
    SELECT
        g,
        id_campeonato,
        id_mandante,
        (((id_mandante - 1 + ((g % 99) + 1)) % 100) + 1)::BIGINT AS id_visitante,
        data_hora,
        status
    FROM base
)
INSERT INTO partida (
    id_campeonato,
    id_mandante,
    id_visitante,
    data_hora,
    estadio,
    gols_mandante,
    gols_visitante,
    status
)
SELECT
    id_campeonato,
    id_mandante,
    id_visitante,
    data_hora,
    'Estádio ' || LPAD((((g - 1) % 50) + 1)::TEXT, 2, '0'),
    CASE WHEN status = 'ENCERRADA' THEN (g % 6)::SMALLINT END,
    CASE WHEN status = 'ENCERRADA' THEN ((g * 3) % 6)::SMALLINT END,
    status
FROM partidas;

ANALYZE clube;
ANALYZE jogador;
ANALYZE campeonato;
ANALYZE clube_campeonato;
ANALYZE partida;

COMMIT;

