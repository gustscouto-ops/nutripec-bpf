import { exigirCtx } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { pdfRecall } from "@/lib/pdf/recall";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const pdf = await pdfRecall(ctx.tenantId, id);
  if (!pdf) return new Response("Não encontrado", { status: 404 });
  await registrarAuditoria(prisma, ctx, { tabela: "recall", registroId: id, acao: "EMISSAO_PDF" });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="recall-${id}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
