import { exigirCtx } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { pdfFormulariosEmBranco } from "@/lib/pdf/rq";
import { modeloEfetivo } from "@/lib/servicos/rq";

/** Formulário em branco de um RQ, na revisão vigente para a empresa (modelo para anexar ao POP). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const pedido = await prisma.rqModelo.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } });
  const modelo = pedido && (await modeloEfetivo(ctx.tenantId, pedido.codigoRq));
  if (!modelo) return new Response("Não encontrado", { status: 404 });
  const pdf = await pdfFormulariosEmBranco(ctx.tenantId, [modelo], `${modelo.codigoRq} - ${modelo.titulo}`);
  await registrarAuditoria(prisma, ctx, { tabela: "rqModelo", registroId: modelo.id, acao: "EMISSAO_FORMULARIO", depois: { codigoRq: modelo.codigoRq, revisao: modelo.versao } });
  const nome = `${modelo.codigoRq.replace(" ", "-")}-rev${String(modelo.versao).padStart(2, "0")}-em-branco.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"`, "Cache-Control": "private, no-store" },
  });
}
