import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lerArquivo } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const foto = await prisma.rqExecucaoFoto.findFirst({ where: { id, execucao: { tenantId: ctx.tenantId } } });
  if (!foto) return new Response("Não encontrado", { status: 404 });
  const arquivo = await lerArquivo(foto.fotoUrl);
  return new Response(new Uint8Array(arquivo), { headers: { "Content-Type": foto.mimeType, "Cache-Control": "private, max-age=86400" } });
}
