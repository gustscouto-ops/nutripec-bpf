import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Cabecalho } from "@/components/ui";
import { FormEmpresa } from "./form";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const ctx = await exigirCtx("empresa:configurar");
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo="Configurações da empresa" subtitulo="Dados que aparecem na folha timbrada dos PDFs e regras de codificação de lotes." />
      <FormEmpresa
        inicial={{
          razaoSocial: t.razaoSocial,
          nomeFantasia: t.nomeFantasia ?? "",
          cnpj: t.cnpj,
          registroMapa: t.registroMapa ?? "",
          endereco: t.endereco ?? "",
          cidadeUf: t.cidadeUf ?? "",
          regraLoteMp: t.regraLoteMp,
          regraLoteProd: t.regraLoteProd,
        }}
      />
    </div>
  );
}
