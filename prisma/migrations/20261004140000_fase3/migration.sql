-- CreateEnum
CREATE TYPE "TipoRecall" AS ENUM ('SIMULADO', 'REAL');

-- CreateEnum
CREATE TYPE "AlvoRecall" AS ENUM ('LOTE_MP', 'LOTE_PRODUTO');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "conservacao" TEXT,
ADD COLUMN     "registro_produto" TEXT,
ADD COLUMN     "validade_dias" INTEGER;

-- CreateTable
CREATE TABLE "recalls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoRecall" NOT NULL,
    "alvo_tipo" "AlvoRecall" NOT NULL,
    "alvo_id" TEXT NOT NULL,
    "alvo_codigo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL,
    "concluido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duracao_min" INTEGER NOT NULL,
    "resultado" JSONB NOT NULL,
    "completo" BOOLEAN NOT NULL,
    "pendencias" JSONB NOT NULL DEFAULT '[]',
    "user_id" TEXT NOT NULL,
    "user_nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "hash" TEXT NOT NULL,
    "rq_execucao_id" TEXT,

    CONSTRAINT "recalls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recalls_rq_execucao_id_key" ON "recalls"("rq_execucao_id");

-- CreateIndex
CREATE UNIQUE INDEX "recalls_tenant_id_numero_key" ON "recalls"("tenant_id", "numero");

-- AddForeignKey
ALTER TABLE "recalls" ADD CONSTRAINT "recalls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalls" ADD CONSTRAINT "recalls_rq_execucao_id_fkey" FOREIGN KEY ("rq_execucao_id") REFERENCES "rq_execucoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Simulados e recolhimentos assinados são imutáveis
CREATE TRIGGER recalls_imutavel
  BEFORE UPDATE OR DELETE ON "recalls"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
