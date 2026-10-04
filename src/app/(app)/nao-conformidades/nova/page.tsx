import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Cabecalho } from "@/components/ui";
import { FormNovaNc } from "./form";

export const metadata = { title: "Registrar não conformidade" };

export default async function NovaNc() {
  const ctx = await exigirCtx("operacao:registrar");
  const [pops, fornecedores] = await Promise.all([
    prisma.pop.findMany({ orderBy: { numeroPop: "asc" }, select: { numeroPop: true, titulo: true } }),
    prisma.fornecedor.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { razaoSocial: "asc" }, select: { id: true, razaoSocial: true } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo="Registrar não conformidade" subtitulo="Para ocorrências fora dos RQs: reclamação de cliente, auditoria interna, fiscalização do MAPA ou outras." />
      <FormNovaNc pops={pops} fornecedores={fornecedores} />
    </div>
  );
}
