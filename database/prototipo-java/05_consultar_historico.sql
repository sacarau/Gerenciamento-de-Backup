SELECT
    id,
    inicio,
    fim,
    modo,
    dias_desde_ultima_manutencao,
    regra,
    acao_manutencao,
    manutencao_executada,
    resultado,
    arquivo_backup,
    mensagem
FROM backup_manager.historico_execucao
ORDER BY id DESC;

