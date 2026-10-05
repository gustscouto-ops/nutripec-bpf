import { exigirCtx } from "@/lib/auth";
import { pdfEmissao } from "@/lib/servicos/manual-bpf";

/** PDF de uma edição já emitida do manual, idêntico ao impresso na época. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirCtx("dossie:gerar");
  const r = await pdfEmissao(ctx.tenantId, (await params).id);
  if (!r) return new Response("Edição não encontrada", { status: 404 });
  return new Response(new Uint8Array(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.nome}"`, "Cache-Control": "private, no-store" },
  });
}
