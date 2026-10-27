-- AlterTable
ALTER TABLE "rq_modelos" ADD COLUMN     "data_revisao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orientacoes" TEXT,
ADD COLUMN     "registros_por_folha" INTEGER;

-- CreateTable
CREATE TABLE "rq_modelo_revisoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "rq_modelo_id" TEXT NOT NULL,
    "codigo_rq" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL,
    "data_revisao" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "alteracoes" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "frequencia" "Frequencia" NOT NULL,
    "campos" JSONB NOT NULL,
    "orientacoes" TEXT,
    "user_id" TEXT,
    "user_nome" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rq_modelo_revisoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rq_verificacoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rq_execucao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "registro_profissional" TEXT,
    "data_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parecer" TEXT,
    "hash" TEXT NOT NULL,
    "ip" TEXT,

    CONSTRAINT "rq_verificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identidade_registros" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome_cabecalho" TEXT NOT NULL,
    "logo_arquivo" TEXT,
    "logo_mime" TEXT,
    "rt_nome" TEXT NOT NULL DEFAULT '',
    "rt_registro" TEXT NOT NULL DEFAULT '',
    "controle_qualidade" TEXT NOT NULL DEFAULT '',
    "proprietario" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identidade_registros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rq_modelo_revisoes_tenant_id_codigo_rq_idx" ON "rq_modelo_revisoes"("tenant_id", "codigo_rq");

-- CreateIndex
CREATE UNIQUE INDEX "rq_verificacoes_rq_execucao_id_key" ON "rq_verificacoes"("rq_execucao_id");

-- CreateIndex
CREATE INDEX "rq_verificacoes_tenant_id_idx" ON "rq_verificacoes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "identidade_registros_tenant_id_key" ON "identidade_registros"("tenant_id");

-- AddForeignKey
ALTER TABLE "rq_modelo_revisoes" ADD CONSTRAINT "rq_modelo_revisoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_verificacoes" ADD CONSTRAINT "rq_verificacoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rq_verificacoes" ADD CONSTRAINT "rq_verificacoes_rq_execucao_id_fkey" FOREIGN KEY ("rq_execucao_id") REFERENCES "rq_execucoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identidade_registros" ADD CONSTRAINT "identidade_registros_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Uma revisão por número em cada RQ (padrão do sistema e versão de cada empresa)
CREATE UNIQUE INDEX "rq_modelo_revisoes_padrao_key" ON "rq_modelo_revisoes"("codigo_rq", "revisao") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX "rq_modelo_revisoes_tenant_key" ON "rq_modelo_revisoes"("tenant_id", "codigo_rq", "revisao") WHERE "tenant_id" IS NOT NULL;

-- Histórico de revisões e verificações são documentos assinados: não se alteram nem se excluem
CREATE TRIGGER rq_modelo_revisoes_imutavel
  BEFORE UPDATE OR DELETE ON "rq_modelo_revisoes"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

CREATE TRIGGER rq_verificacoes_imutavel
  BEFORE UPDATE OR DELETE ON "rq_verificacoes"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();

-- A revisão vigente de cada RQ passa a ter data: a da última alteração conhecida
UPDATE "rq_modelos" SET "data_revisao" = "updated_at";

-- Ponto de partida do histórico: a revisão vigente de cada RQ na implantação do controle
INSERT INTO "rq_modelo_revisoes" ("id", "tenant_id", "rq_modelo_id", "codigo_rq", "revisao", "data_revisao", "motivo", "alteracoes", "titulo", "frequencia", "campos", "orientacoes", "user_id", "user_nome", "hash")
SELECT 'rev_' || m."id", m."tenant_id", m."id", m."codigo_rq", m."versao", m."updated_at",
       'Revisão vigente na implantação do controle de revisões', 'Conteúdo vigente registrado como ponto de partida do histórico.',
       m."titulo", m."frequencia", m."campos", m."orientacoes", NULL, COALESCE(m."atualizado_por", 'Sistema'),
       encode(sha256(convert_to(m."codigo_rq" || '|' || m."versao" || '|' || m."titulo" || '|' || m."campos"::text, 'UTF8')), 'hex')
FROM "rq_modelos" m;
