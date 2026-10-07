# Scripts de banco de dados

## Base normalizada do domínio

1. Conectado ao banco `postgres`:
   - `00_criar_banco_futebol.sql`
   - `00_criar_banco_controle.sql`
2. Conectado ao banco `futebol_times`:
   - `futebol/01_criar_estrutura.sql`
   - `futebol/02_carga_inicial.sql`
   - `futebol/03_validar_carga.sql`
3. Conectado ao banco `backup_manager`:
   - `controle/01_criar_estrutura.sql`
   - `controle/02_carga_inicial.sql`

Os scripts de estrutura removem e recriam as tabelas do respectivo banco. Utilize-os apenas no ambiente de desenvolvimento com dados fictícios.

## Entrega 3 — manutenção e backup

A aplicação web aceita qualquer banco PostgreSQL e cria seu histórico no
schema `backup_manager` do próprio banco-alvo. Os scripts específicos estão em
`entrega-03`:

- `04_criar_historico.sql`: preparação manual opcional;
- `05_consultar_historico.sql`: conferência dos registros;
- `cenarios`: dados controlados para testar as quatro regras de tempo.

Para repetir a demonstração com o banco `Projeto2`, a massa já usada pela dupla
continua em `prototipo-java`. O nome da pasta foi preservado por compatibilidade;
os arquivos SQL funcionam independentemente da aplicação Java.

## Entrega 4 - versão final

Os scripts de `entrega-04` documentam a estrutura final criada pela aplicação:

- `01_criar_estrutura_final.sql`: adiciona informações de proteção, cópia e
  logs ao histórico e cria o histórico de restauração;
- `02_conferir_resultados.sql`: consulta backups e restaurações recentes.

A execução manual é opcional, pois o backend aplica essas instruções de forma
idempotente ao validar a conexão.
