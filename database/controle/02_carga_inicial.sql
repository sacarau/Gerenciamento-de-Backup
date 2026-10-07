BEGIN;

TRUNCATE TABLE log_execucao, etapa_execucao, manutencao_historico,
    execucao_backup, configuracao_backup RESTART IDENTITY CASCADE;

INSERT INTO configuracao_backup (
    nome,
    host_banco,
    porta_banco,
    banco_alvo,
    usuario_banco,
    caminho_destino,
    quantidade_manter,
    caminho_copia,
    opcoes
)
VALUES (
    'Configuração local de demonstração',
    'localhost',
    5432,
    'futebol_times',
    'postgres',
    'C:/backups/principal',
    5,
    NULL,
    '{"manutencao": true, "manutencaoCompleta": false, "aes": false, "zip": false}'::JSONB
);

COMMIT;
