-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('CEO', 'RT', 'CONSULTOR', 'OPERADOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TipoPlano" AS ENUM ('ESSENCIAL', 'PROFISSIONAL', 'CONSULTORIA');

-- CreateEnum
CREATE TYPE "StatusQualificacao" AS ENUM ('APROVADO', 'REPROVADO', 'EM_AVALIACAO');

-- CreateEnum
CREATE TYPE "CategoriaMp" AS ENUM ('MACROINGREDIENTE', 'MICROMINERAL', 'MACROMINERAL', 'VITAMINA', 'PREMIX', 'NUCLEO', 'ADITIVO', 'MEDICAMENTO', 'EMBALAGEM', 'OUTRO');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'G', 'TON', 'SC', 'L');

-- CreateEnum
CREATE TYPE "StatusFormula" AS ENUM ('RASCUNHO', 'AGUARDANDO_RT', 'APROVADA');

-- CreateEnum
CREATE TYPE "Frequencia" AS ENUM ('DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'SEMESTRAL', 'ANUAL', 'PERIODICA', 'QUANDO_OCORRE');

-- CreateEnum
CREATE TYPE "StatusRq" AS ENUM ('CONFORME', 'NAO_CONFORME');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('LIBERADO', 'QUARENTENA', 'REPROVADO');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "registro_sif_mapa" TEXT,
    "endereco" TEXT,
    "cidade_uf" TEXT,
    "tipo_plano" "TipoPlano" NOT NULL DEFAULT 'ESSENCIAL',
    "regra_lote_mp" TEXT NOT NULL DEFAULT '{PREFIXO}-{DDMMAAAA}',
    "regra_lote_prod" TEXT NOT NULL DEFAULT '{CODIGO}-{DD}{MM}{AA}-{SEQ}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "registro_profissional" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "cargo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "registro_mapa" TEXT,
    "contato" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cidade_uf" TEXT,
    "status_qualificacao" "StatusQualificacao" NOT NULL DEFAULT 'EM_AVALIACAO',
    "data_qualificacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias_primas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "codigo" TEXT,
    "nome_comercial" TEXT NOT NULL,
    "nome_tecnico" TEXT,
    "prefixo_lote" TEXT NOT NULL,
    "categoria" "CategoriaMp" NOT NULL,
    "unidade_medida" "UnidadeMedida" NOT NULL DEFAULT 'KG',
    "peso_embalagem_kg" DECIMAL(12,3),
    "umidade_max_pct" DECIMAL(5,2),
    "temperatura_max_c" DECIMAL(5,1),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_primas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor_materias_primas" (
    "fornecedor_id" TEXT NOT NULL,
    "materia_prima_id" TEXT NOT NULL,
    "homologado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fornecedor_materias_primas_pkey" PRIMARY KEY ("fornecedor_id","materia_prima_id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "especie_destino" TEXT,
    "categoria" TEXT,
    "tipo_embalagem" TEXT,
    "peso_sacaria" DECIMAL(10,3) NOT NULL DEFAULT 25,
    "tamanho_batelada_kg" DECIMAL(12,3) NOT NULL DEFAULT 1000,
    "modelo_etiqueta" TEXT,
    "indicacao_uso" TEXT,
    "modo_uso" TEXT,
    "composicao_basica" TEXT,
    "substitutivos" TEXT,
    "restricoes" TEXT,
    "niveis_garantia" JSONB NOT NULL DEFAULT '[]',
    "status_formula" "StatusFormula" NOT NULL DEFAULT 'RASCUNHO',
    "versao_formula" INTEGER NOT NULL DEFAULT 1,
    "aprovado_rt_user_id" TEXT,
    "aprovado_rt_nome" TEXT,
    "data_aprovacao_rt" TIMESTAMP(3),
    "hash_formula" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulas_itens" (
    "id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "materia_prima_id" TEXT NOT NULL,
    "percentual" DECIMAL(8,4) NOT NULL,
    "quantidade_batelada_kg" DECIMAL(12,3) NOT NULL,
    "ordem_dosagem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "formulas_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pops" (
    "id" TEXT NOT NULL,
    "numero_pop" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao_procedimento" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rq_modelos" (
    "id" TEXT NOT NULL,
    "pop_id" TEXT NOT NULL,
    "codigo_rq" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "frequencia" "Frequencia" NOT NULL,
    "campos" JSONB NOT NULL DEFAULT '[]',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rq_modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rq_execucoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rq_modelo_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "user_id_assinatura" TEXT NOT NULL,
    "nome_assinatura" TEXT NOT NULL,
    "perfil_assinatura" "Perfil" NOT NULL,
    "data_hora_execucao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusRq" NOT NULL,
    "respostas" JSONB NOT NULL,
    "cabecalho" JSONB NOT NULL DEFAULT '{}',
    "observacoes" TEXT,
    "hash_assinatura" TEXT NOT NULL,
    "ip_origem" TEXT,
    "pdf_url" TEXT,

    CONSTRAINT "rq_execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rq_execucoes_fotos" (
    "id" TEXT NOT NULL,
    "rq_execucao_id" TEXT NOT NULL,
    "foto_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "descricao" TEXT,
    "hash_arquivo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rq_execucoes_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_materia_prima" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "materia_prima_id" TEXT NOT NULL,
    "fornecedor_id" TEXT NOT NULL,
    "codigo_lote_interno" TEXT NOT NULL,
    "lote_fornecedor" TEXT,
    "numero_nf" TEXT NOT NULL,
    "quantidade_kg" DECIMAL(14,3) NOT NULL,
    "data_recebimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fabricacao" TIMESTAMP(3),
    "data_validade" TIMESTAMP(3),
    "status" "StatusLote" NOT NULL,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "decisao_rt_user_id" TEXT,
    "decisao_rt_nome" TEXT,
    "decisao_rt_em" TIMESTAMP(3),
    "decisao_rt_motivo" TEXT,
    "rq_execucao_id" TEXT,

    CONSTRAINT "lotes_materia_prima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao_ordens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "produto_id" TEXT NOT NULL,
    "codigo_lote_produzido" TEXT NOT NULL,
    "sequencia_dia" INTEGER NOT NULL,
    "misturador" TEXT,
    "data_hora_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turno" "Turno" NOT NULL,
    "numero_bateladas" INTEGER NOT NULL,
    "quantidade_sacas_produzidas" INTEGER NOT NULL,
    "data_validade" TIMESTAMP(3),
    "versao_formula" INTEGER NOT NULL,
    "operador_user_id" TEXT NOT NULL,
    "operador_nome" TEXT NOT NULL,
    "hash_assinatura" TEXT NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "producao_ordens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao_consumo_lotes" (
    "id" TEXT NOT NULL,
    "producao_ordem_id" TEXT NOT NULL,
    "lote_materia_prima_id" TEXT NOT NULL,
    "quantidade_utilizada_kg" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "producao_consumo_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedicao_envios" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cliente_nome" TEXT NOT NULL,
    "cliente_documento" TEXT,
    "cliente_cidade_uf" TEXT,
    "numero_nf" TEXT NOT NULL,
    "placa_veiculo" TEXT,
    "producao_ordem_id" TEXT NOT NULL,
    "quantidade_sacas" INTEGER NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "user_nome" TEXT NOT NULL,

    CONSTRAINT "expedicao_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "user_nome" TEXT,
    "tabela_afetada" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_tenant_id_cnpj_key" ON "fornecedores"("tenant_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "materias_primas_tenant_id_prefixo_lote_key" ON "materias_primas"("tenant_id", "prefixo_lote");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_tenant_id_codigo_key" ON "produtos"("tenant_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "formulas_itens_produto_id_materia_prima_id_key" ON "formulas_itens"("produto_id", "materia_prima_id");

-- CreateIndex
CREATE UNIQUE INDEX "pops_numero_pop_key" ON "pops"("numero_pop");

-- CreateIndex
CREATE UNIQUE INDEX "rq_modelos_codigo_rq_key" ON "rq_modelos"("codigo_rq");

-- CreateIndex
CREATE UNIQUE INDEX "rq_execucoes_tenant_id_rq_modelo_id_numero_key" ON "rq_execucoes"("tenant_id", "rq_modelo_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_materia_prima_rq_execucao_id_key" ON "lotes_materia_prima"("rq_execucao_id");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_materia_prima_tenant_id_codigo_lote_interno_key" ON "lotes_materia_prima"("tenant_id", "codigo_lote_interno");

-- CreateIndex
CREATE UNIQUE INDEX "producao_ordens_tenant_id_codigo_lote_produzido_key" ON "producao_ordens"("tenant_id", "codigo_lote_produzido");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_tabela_afetada_registro_id_idx" ON "audit_logs"("tenant_id", "tabela_afetada", "registro_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias_primas" ADD CONSTRAINT "materias_primas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_materias_primas" ADD CONSTRAINT "fornecedor_materias_primas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_materias_primas" ADD CONSTRAINT "fornecedor_materias_primas_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas_itens" ADD CONSTRAINT "formulas_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formulas_itens" ADD CONSTRAINT "formulas_itens_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_modelos" ADD CONSTRAINT "rq_modelos_pop_id_fkey" FOREIGN KEY ("pop_id") REFERENCES "pops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_execucoes" ADD CONSTRAINT "rq_execucoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_execucoes" ADD CONSTRAINT "rq_execucoes_rq_modelo_id_fkey" FOREIGN KEY ("rq_modelo_id") REFERENCES "rq_modelos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_execucoes_fotos" ADD CONSTRAINT "rq_execucoes_fotos_rq_execucao_id_fkey" FOREIGN KEY ("rq_execucao_id") REFERENCES "rq_execucoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_materia_prima" ADD CONSTRAINT "lotes_materia_prima_rq_execucao_id_fkey" FOREIGN KEY ("rq_execucao_id") REFERENCES "rq_execucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_ordens" ADD CONSTRAINT "producao_ordens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_ordens" ADD CONSTRAINT "producao_ordens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_consumo_lotes" ADD CONSTRAINT "producao_consumo_lotes_producao_ordem_id_fkey" FOREIGN KEY ("producao_ordem_id") REFERENCES "producao_ordens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_consumo_lotes" ADD CONSTRAINT "producao_consumo_lotes_lote_materia_prima_id_fkey" FOREIGN KEY ("lote_materia_prima_id") REFERENCES "lotes_materia_prima"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicao_envios" ADD CONSTRAINT "expedicao_envios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedicao_envios" ADD CONSTRAINT "expedicao_envios_producao_ordem_id_fkey" FOREIGN KEY ("producao_ordem_id") REFERENCES "producao_ordens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── Trilha de auditoria imutável ─────────────
CREATE OR REPLACE FUNCTION bloquear_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável: % em % não é permitido (trilha de auditoria / registro assinado)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_imutavel
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- RQs assinados não podem ser alterados nem excluídos (o PDF só registra o pdf_url uma vez)
CREATE OR REPLACE FUNCTION proteger_rq_assinado() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RQ assinado não pode ser excluído';
  END IF;
  IF NEW.respostas IS DISTINCT FROM OLD.respostas
     OR NEW.cabecalho IS DISTINCT FROM OLD.cabecalho
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.hash_assinatura IS DISTINCT FROM OLD.hash_assinatura
     OR NEW.user_id_assinatura IS DISTINCT FROM OLD.user_id_assinatura
     OR NEW.data_hora_execucao IS DISTINCT FROM OLD.data_hora_execucao THEN
    RAISE EXCEPTION 'RQ assinado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rq_execucoes_imutavel
  BEFORE UPDATE OR DELETE ON "rq_execucoes"
  FOR EACH ROW EXECUTE FUNCTION proteger_rq_assinado();

CREATE TRIGGER rq_fotos_imutavel
  BEFORE UPDATE OR DELETE ON "rq_execucoes_fotos"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- Consumos de lotes em produção são registros de rastreabilidade: não podem ser alterados
CREATE TRIGGER consumo_lotes_imutavel
  BEFORE UPDATE OR DELETE ON "producao_consumo_lotes"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
