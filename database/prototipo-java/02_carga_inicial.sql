BEGIN;

TRUNCATE TABLE
    public.corinthians,
    public.palmeiras,
    public.santos,
    public.saopaulo
RESTART IDENTITY;

INSERT INTO public.corinthians (numero, nome, posicao, perna, condicao, salario_m)
SELECT
    ((g - 1) % 99) + 1,
    'Jogador Corinthians ' || LPAD(g::TEXT, 3, '0'),
    (ARRAY['Goleiro', 'Defensor', 'Meio-campo', 'Atacante'])[((g - 1) % 4) + 1],
    CASE WHEN g % 4 = 0 THEN 'Canhoto' ELSE 'Destro' END,
    CASE WHEN g % 10 = 0 THEN 'Em recuperacao' ELSE 'Saudavel' END,
    20000 + (g * 500)
FROM generate_series(1, 100) AS g;

INSERT INTO public.palmeiras (numero, nome, posicao, perna, condicao, salario_m)
SELECT
    ((g - 1) % 99) + 1,
    'Jogador Palmeiras ' || LPAD(g::TEXT, 3, '0'),
    (ARRAY['Goleiro', 'Defensor', 'Meio-campo', 'Atacante'])[((g - 1) % 4) + 1],
    CASE WHEN g % 4 = 0 THEN 'Canhoto' ELSE 'Destro' END,
    CASE WHEN g % 10 = 0 THEN 'Em recuperacao' ELSE 'Saudavel' END,
    21000 + (g * 500)
FROM generate_series(1, 100) AS g;

INSERT INTO public.santos (numero, nome, posicao, perna, condicao, salario_m)
SELECT
    ((g - 1) % 99) + 1,
    'Jogador Santos ' || LPAD(g::TEXT, 3, '0'),
    (ARRAY['Goleiro', 'Defensor', 'Meio-campo', 'Atacante'])[((g - 1) % 4) + 1],
    CASE WHEN g % 4 = 0 THEN 'Canhoto' ELSE 'Destro' END,
    CASE WHEN g % 10 = 0 THEN 'Em recuperacao' ELSE 'Saudavel' END,
    19000 + (g * 500)
FROM generate_series(1, 100) AS g;

INSERT INTO public.saopaulo (numero, nome, posicao, perna, condicao, salario_m)
SELECT
    ((g - 1) % 99) + 1,
    'Jogador Sao Paulo ' || LPAD(g::TEXT, 3, '0'),
    (ARRAY['Goleiro', 'Defensor', 'Meio-campo', 'Atacante'])[((g - 1) % 4) + 1],
    CASE WHEN g % 4 = 0 THEN 'Canhoto' ELSE 'Destro' END,
    CASE WHEN g % 10 = 0 THEN 'Em recuperacao' ELSE 'Saudavel' END,
    22000 + (g * 500)
FROM generate_series(1, 100) AS g;

COMMIT;

