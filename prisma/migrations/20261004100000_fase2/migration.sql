-- CreateEnum
CREATE TYPE "StatusNc" AS ENUM ('ABERTA', 'EM_TRATAMENTO', 'AGUARDANDO_VERIFICACAO', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "GravidadeNc" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "OrigemNc" AS ENUM ('RQ', 'RECLAMACAO_CLIENTE', 'AUDITORIA_INTERNA', 'FISCALIZACAO', 'OUTRA');

-- DropIndex
DROP INDEX "rq_execucoes_tenant_id_rq_modelo_id_numero_key";

-- DropIndex
DROP INDEX "rq_modelos_codigo_rq_key";

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "receber_alertas" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rq_execucoes" ADD COLUMN     "atrasado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "campos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "codigo_rq" TEXT,
ADD COLUMN     "referencia_fim" TIMESTAMP(3),
ADD COLUMN     "referencia_inicio" TIMESTAMP(3),
ADD COLUMN     "versao_modelo" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "rq_modelos" ADD COLUMN     "atualizado_por" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dia_mes" INTEGER,
ADD COLUMN     "dia_semana" INTEGER,
ADD COLUMN     "origem_id" TEXT,
ADD COLUMN     "perfil_responsavel" "Perfil",
ADD COLUMN     "tenant_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telefone" TEXT;

-- CreateTable
CREATE TABLE "nao_conformidades" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "origem" "OrigemNc" NOT NULL DEFAULT 'RQ',
    "rq_execucao_id" TEXT,
    "campo_id" TEXT,
    "pop_numero" INTEGER,
    "fornecedor_id" TEXT,
    "lote_referencia" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "acao_imediata" TEXT NOT NULL,
    "gravidade" "GravidadeNc" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusNc" NOT NULL DEFAULT 'ABERTA',
    "aberta_por_id" TEXT NOT NULL,
    "aberta_por_nome" TEXT NOT NULL,
    "aberta_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "causa_raiz" TEXT,
    "acao_preventiva" TEXT,
    "responsavel_acao" TEXT,
    "prazo" TIMESTAMP(3),
    "plano_por_nome" TEXT,
    "plano_em" TIMESTAMP(3),
    "execucao_descricao" TEXT,
    "executada_por_nome" TEXT,
    "executada_em" TIMESTAMP(3),
    "verificacao_eficacia" TEXT,
    "eficaz" BOOLEAN,
    "encerrada_por_id" TEXT,
    "encerrada_por_nome" TEXT,
    "encerrada_em" TIMESTAMP(3),
    "hash_encerramento" TEXT,

    CONSTRAINT "nao_conformidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrucoes_trabalho" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "origem_id" TEXT,
    "pop_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "objetivo" TEXT,
    "passos" JSONB NOT NULL DEFAULT '[]',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_por" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrucoes_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nao_conformidades_tenant_id_status_idx" ON "nao_conformidades"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "nao_conformidades_tenant_id_numero_key" ON "nao_conformidades"("tenant_id", "numero");

-- CreateIndex
CREATE INDEX "instrucoes_trabalho_tenant_id_codigo_idx" ON "instrucoes_trabalho"("tenant_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_tenant_id_canal_destino_chave_key" ON "notificacoes"("tenant_id", "canal", "destino", "chave");

-- CreateIndex
CREATE INDEX "rq_execucoes_tenant_id_codigo_rq_referencia_inicio_idx" ON "rq_execucoes"("tenant_id", "codigo_rq", "referencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "rq_execucoes_tenant_id_codigo_rq_numero_key" ON "rq_execucoes"("tenant_id", "codigo_rq", "numero");

-- CreateIndex
CREATE INDEX "rq_modelos_tenant_id_codigo_rq_idx" ON "rq_modelos"("tenant_id", "codigo_rq");

-- AddForeignKey
ALTER TABLE "rq_modelos" ADD CONSTRAINT "rq_modelos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nao_conformidades" ADD CONSTRAINT "nao_conformidades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nao_conformidades" ADD CONSTRAINT "nao_conformidades_rq_execucao_id_fkey" FOREIGN KEY ("rq_execucao_id") REFERENCES "rq_execucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nao_conformidades" ADD CONSTRAINT "nao_conformidades_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrucoes_trabalho" ADD CONSTRAINT "instrucoes_trabalho_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrucoes_trabalho" ADD CONSTRAINT "instrucoes_trabalho_pop_id_fkey" FOREIGN KEY ("pop_id") REFERENCES "pops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────── Backfill dos registros existentes ─────────────
UPDATE "rq_execucoes" e SET
  "codigo_rq" = m."codigo_rq",
  "campos" = m."campos",
  "versao_modelo" = m."versao",
  "referencia_inicio" = (date_trunc('day', e."data_hora_execucao" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC',
  "referencia_fim" = ((date_trunc('day', e."data_hora_execucao" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'
FROM "rq_modelos" m WHERE m."id" = e."rq_modelo_id";
ALTER TABLE "rq_execucoes" ALTER COLUMN "codigo_rq" SET NOT NULL;

-- Um único modelo padrão por código, e no máximo uma versão própria por empresa e código
CREATE UNIQUE INDEX "rq_modelos_padrao_codigo_key" ON "rq_modelos"("codigo_rq") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX "rq_modelos_tenant_codigo_key" ON "rq_modelos"("tenant_id", "codigo_rq") WHERE "tenant_id" IS NOT NULL;
CREATE UNIQUE INDEX "instrucoes_padrao_codigo_key" ON "instrucoes_trabalho"("codigo") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX "instrucoes_tenant_codigo_key" ON "instrucoes_trabalho"("tenant_id", "codigo") WHERE "tenant_id" IS NOT NULL;

-- O snapshot dos campos, a referência e o código também passam a ser protegidos após a assinatura
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
     OR NEW.data_hora_execucao IS DISTINCT FROM OLD.data_hora_execucao
     OR (OLD.codigo_rq IS NOT NULL AND NEW.codigo_rq IS DISTINCT FROM OLD.codigo_rq)
     OR (OLD.campos <> '[]'::jsonb AND NEW.campos IS DISTINCT FROM OLD.campos)
     OR (OLD.referencia_inicio IS NOT NULL AND NEW.referencia_inicio IS DISTINCT FROM OLD.referencia_inicio)
     OR NEW.atrasado IS DISTINCT FROM OLD.atrasado THEN
    RAISE EXCEPTION 'RQ assinado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Encerramento de NC é assinado: depois de ENCERRADA, não volta a ser editada
CREATE OR REPLACE FUNCTION proteger_nc_encerrada() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Não conformidade não pode ser excluída (use CANCELADA com justificativa)';
  END IF;
  IF OLD.status IN ('ENCERRADA', 'CANCELADA') THEN
    RAISE EXCEPTION 'Não conformidade encerrada não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nao_conformidades_protegida
  BEFORE UPDATE OR DELETE ON "nao_conformidades"
  FOR EACH ROW EXECUTE FUNCTION proteger_nc_encerrada();
