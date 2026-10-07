TRUNCATE TABLE backup_manager.historico_execucao RESTART IDENTITY;

INSERT INTO backup_manager.historico_execucao (
    inicio, fim, modo, dias_desde_ultima_manutencao, regra,
    acao_manutencao, manutencao_executada, resultado, mensagem
) VALUES (
    CURRENT_TIMESTAMP - INTERVAL '15 days 5 minutes',
    CURRENT_TIMESTAMP - INTERVAL '15 days',
    'CENARIO', NULL, 'Preparação do cenário de menos de 30 dias.',
    'VACUUM', TRUE, 'SUCESSO',
    'Registro fictício criado exclusivamente para o teste da regra.'
);
