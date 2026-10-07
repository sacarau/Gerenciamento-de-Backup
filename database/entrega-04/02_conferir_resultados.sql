SELECT
    id,
    inicio,
    fim,
    modo,
    acao_manutencao,
    criptografado,
    compactado,
    resultado,
    arquivo_backup,
    copia_adicional,
    arquivo_log,
    email_log_simulado
FROM backup_manager.historico_execucao
ORDER BY id DESC
LIMIT 20;

SELECT
    id,
    inicio,
    fim,
    arquivo_origem,
    banco_destino,
    resultado,
    total_tabelas,
    total_registros,
    mensagem
FROM backup_manager.historico_restauracao
ORDER BY id DESC
LIMIT 20;

