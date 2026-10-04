import { notFound, redirect } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import type { PassoIt } from "@/lib/rq/instrucoes";
import { Alerta, Cabecalho } from "@/components/ui";
import { EditorIt } from "./editor";

export const metadata = { title: "Editar instrução" };

export default async function EditarIt({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "formulario:customizar")) return <Alerta>Somente o RT ou o consultor editam instruções.</Alerta>;
  const { id } = await params;
  const it = await prisma.instrucaoTrabalho.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] }, include: { pop: true } });
  if (!it) notFound();
  if (!it.tenantId) {
    const propria = await prisma.instrucaoTrabalho.findFirst({ where: { tenantId: ctx.tenantId, codigo: it.codigo }, select: { id: true } });
    if (propria) redirect(`/instrucoes/${propria.id}/editar`);
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo={`${it.codigo} — editar`} subtitulo={`POP ${String(it.pop.numeroPop).padStart(2, "0")} · ${it.pop.titulo} · v${it.versao}${it.tenantId ? "" : " · ao salvar, a empresa passa a ter versão própria"}`} />
      <EditorIt id={it.id} inicial={{ titulo: it.titulo, objetivo: it.objetivo ?? "", ativo: it.ativo, passos: it.passos as unknown as PassoIt[] }} />
    </div>
  );
}
