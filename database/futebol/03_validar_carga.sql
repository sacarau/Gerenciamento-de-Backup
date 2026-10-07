SELECT 'clube' AS tabela, COUNT(*) AS quantidade FROM clube
UNION ALL
SELECT 'jogador', COUNT(*) FROM jogador
UNION ALL
SELECT 'campeonato', COUNT(*) FROM campeonato
UNION ALL
SELECT 'clube_campeonato', COUNT(*) FROM clube_campeonato
UNION ALL
SELECT 'partida', COUNT(*) FROM partida
ORDER BY tabela;

SELECT
    COUNT(*) FILTER (WHERE status = 'ENCERRADA') AS partidas_encerradas,
    COUNT(*) FILTER (WHERE status = 'AGENDADA') AS partidas_agendadas,
    COUNT(*) FILTER (WHERE status = 'CANCELADA') AS partidas_canceladas,
    COALESCE(SUM(gols_mandante + gols_visitante), 0) AS total_gols
FROM partida;

SELECT
    pg_size_pretty(pg_database_size(current_database())) AS tamanho_banco,
    current_database() AS banco_validado,
    CURRENT_TIMESTAMP AS validado_em;

SELECT COUNT(*) AS jogadores_sem_clube
FROM jogador AS j
LEFT JOIN clube AS c ON c.id_clube = j.id_clube
WHERE c.id_clube IS NULL;

SELECT COUNT(*) AS partidas_com_mesmo_clube
FROM partida
WHERE id_mandante = id_visitante;

SELECT
    p.id_partida,
    camp.nome AS campeonato,
    camp.temporada,
    mandante.nome AS mandante,
    visitante.nome AS visitante,
    p.gols_mandante,
    p.gols_visitante,
    p.status,
    p.data_hora
FROM partida AS p
INNER JOIN campeonato AS camp
    ON camp.id_campeonato = p.id_campeonato
INNER JOIN clube AS mandante
    ON mandante.id_clube = p.id_mandante
INNER JOIN clube AS visitante
    ON visitante.id_clube = p.id_visitante
ORDER BY p.id_partida
LIMIT 20;

