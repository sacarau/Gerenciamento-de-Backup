
BEGIN;

DROP TABLE IF EXISTS public.corinthians CASCADE;
DROP TABLE IF EXISTS public.palmeiras CASCADE;
DROP TABLE IF EXISTS public.santos CASCADE;
DROP TABLE IF EXISTS public.saopaulo CASCADE;

CREATE TABLE public.corinthians (
    id SERIAL PRIMARY KEY,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 99),
    nome VARCHAR(50) NOT NULL,
    posicao VARCHAR(20) NOT NULL,
    perna VARCHAR(20) NOT NULL,
    condicao VARCHAR(50) NOT NULL DEFAULT 'Saudavel',
    salario_m INTEGER NOT NULL CHECK (salario_m >= 0)
);

CREATE TABLE public.palmeiras (
    id SERIAL PRIMARY KEY,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 99),
    nome VARCHAR(50) NOT NULL,
    posicao VARCHAR(20) NOT NULL,
    perna VARCHAR(20) NOT NULL,
    condicao VARCHAR(50) NOT NULL DEFAULT 'Saudavel',
    salario_m INTEGER NOT NULL CHECK (salario_m >= 0)
);

CREATE TABLE public.santos (
    id SERIAL PRIMARY KEY,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 99),
    nome VARCHAR(50) NOT NULL,
    posicao VARCHAR(20) NOT NULL,
    perna VARCHAR(20) NOT NULL,
    condicao VARCHAR(50) NOT NULL DEFAULT 'Saudavel',
    salario_m INTEGER NOT NULL CHECK (salario_m >= 0)
);

CREATE TABLE public.saopaulo (
    id SERIAL PRIMARY KEY,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 99),
    nome VARCHAR(50) NOT NULL,
    posicao VARCHAR(20) NOT NULL,
    perna VARCHAR(20) NOT NULL DEFAULT 'Destro',
    condicao VARCHAR(50) NOT NULL DEFAULT 'Saudavel',
    salario_m INTEGER NOT NULL CHECK (salario_m >= 0)
);

COMMIT;

