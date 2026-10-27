import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lerArquivo } from "@/lib/storage";

/** Logo da empresa usado no cabeçalho dos RQs. */
export async function GET() {
  const ctx = await exigirCtx();
  const ident = await prisma.identidadeRegistros.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!ident?.logoArquivo || !ident.logoMime) return new Response("Sem logo", { status: 404 });
  try {
    return new Response(new Uint8Array(await lerArquivo(ident.logoArquivo)), { headers: { "Content-Type": ident.logoMime, "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Arquivo não encontrado", { status: 404 });
  }
}
