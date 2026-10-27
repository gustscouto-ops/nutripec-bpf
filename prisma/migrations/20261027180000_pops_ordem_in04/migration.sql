-- Renumera os 9 POPs para a ordem dos manuais de BPF do setor (IN MAPA 04/2007):
-- 01 Fornecedores, MP e embalagens · 02 Limpeza · 03 Pessoal · 04 Água · 05 Contaminação cruzada
-- 06 Manutenção e calibração · 07 Pragas · 08 Resíduos e efluentes · 09 Rastreabilidade e recall
-- Numeração antiga → nova: 4→6, 5→4, 6→7, 7→5, 8→9, 9→8 (1, 2 e 3 não mudam).
-- Registros já assinados (rq_execucoes) e NCs encerradas mantêm o código com que foram assinados: o código de um RQ assinado
-- e de uma NC encerrada é imutável por trigger desde a Fase 2, e esta migração não contorna essa regra.

CREATE TEMP TABLE pop_mapa (antigo INT PRIMARY KEY, novo INT NOT NULL);
INSERT INTO pop_mapa VALUES (1,1),(2,2),(3,3),(4,6),(5,4),(6,7),(7,5),(8,9),(9,8);

-- POPs: duas etapas por causa do índice único em numero_pop
UPDATE "pops" SET "numero_pop" = "numero_pop" + 100;
UPDATE "pops" p SET "numero_pop" = m.novo FROM pop_mapa m WHERE p."numero_pop" = m.antigo + 100;

-- Códigos "RQ N.x" (modelos padrão e versões das empresas) e "IT 0N.xx".
-- Os índices únicos são conferidos linha a linha, então a troca passa por um prefixo temporário "~".
UPDATE "rq_modelos" r SET "codigo_rq" = '~RQ ' || m.novo || substring(r."codigo_rq" from '\.\d+$')
  FROM pop_mapa m WHERE r."codigo_rq" ~ '^RQ \d+\.\d+$' AND split_part(substring(r."codigo_rq" from 4), '.', 1)::int = m.antigo AND m.antigo <> m.novo;

UPDATE "instrucoes_trabalho" i SET "codigo" = '~IT ' || lpad(m.novo::text, 2, '0') || substring(i."codigo" from '\.\d+$')
  FROM pop_mapa m WHERE i."codigo" ~ '^IT \d+\.\d+$' AND split_part(substring(i."codigo" from 4), '.', 1)::int = m.antigo AND m.antigo <> m.novo;

UPDATE "rq_modelos" SET "codigo_rq" = substring("codigo_rq" from 2) WHERE "codigo_rq" LIKE '~%';
UPDATE "instrucoes_trabalho" SET "codigo" = substring("codigo" from 2) WHERE "codigo" LIKE '~%';

-- Não conformidades em aberto vinculadas a um POP (encerradas e canceladas são imutáveis)
UPDATE "nao_conformidades" n SET "pop_numero" = m.novo FROM pop_mapa m WHERE n."pop_numero" = m.antigo AND m.antigo <> m.novo AND n."status" NOT IN ('ENCERRADA', 'CANCELADA');

DROP TABLE pop_mapa;
