import { exigirCtx } from "@/lib/auth";
import { ErroNegocio } from "@/lib/erros";
import { gerarPacoteDossie } from "@/lib/servicos/pacote-dossie";

export const maxDuration = 300;

/** Pacote ZIP "Preparar Auditoria MAPA" para o período informado. */
export async function GET(req: Request) {
  const ctx = await exigirCtx("dossie:gerar");
  const u = new URL(req.url).searchParams;
  try {
    const { nome, buffer } = await gerarPacoteDossie(ctx, u.get("inicio") ?? "", u.get("fim") ?? "");
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof ErroNegocio) return new Response(e.message, { status: 400 });
    throw e;
  }
}
