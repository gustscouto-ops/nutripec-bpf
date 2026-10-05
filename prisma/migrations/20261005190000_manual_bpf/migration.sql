-- CreateTable
CREATE TABLE "manual_bpf_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inscricao_estadual" TEXT NOT NULL DEFAULT '',
    "logradouro" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "cep" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "atividade" TEXT NOT NULL DEFAULT '',
    "cabecalho_linha1" TEXT NOT NULL DEFAULT '',
    "cabecalho_linha2" TEXT NOT NULL DEFAULT '',
    "rt_nome" TEXT NOT NULL DEFAULT '',
    "rt_registro" TEXT NOT NULL DEFAULT '',
    "responsavel_legal" TEXT NOT NULL DEFAULT '',
    "responsavel_fabrica" TEXT NOT NULL DEFAULT '',
    "controle_qualidade" TEXT NOT NULL DEFAULT '',
    "data_emissao" TEXT NOT NULL,
    "revisao" TEXT NOT NULL DEFAULT '02',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_bpf_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_bpf_emissoes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_emissao" TEXT NOT NULL,
    "revisao" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "hash_dados" TEXT NOT NULL,
    "hash_pdf" TEXT NOT NULL,
    "paginas" INTEGER NOT NULL,
    "arquivo" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_nome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_bpf_emissoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_bpf_config_tenant_id_key" ON "manual_bpf_config"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_bpf_emissoes_tenant_id_numero_key" ON "manual_bpf_emissoes"("tenant_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "manual_bpf_emissoes_tenant_id_hash_dados_key" ON "manual_bpf_emissoes"("tenant_id", "hash_dados");

-- AddForeignKey
ALTER TABLE "manual_bpf_config" ADD CONSTRAINT "manual_bpf_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_bpf_emissoes" ADD CONSTRAINT "manual_bpf_emissoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Emissões do manual são histórico: não se alteram nem se apagam
CREATE TRIGGER manual_bpf_emissoes_imutavel
  BEFORE UPDATE OR DELETE ON "manual_bpf_emissoes"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
