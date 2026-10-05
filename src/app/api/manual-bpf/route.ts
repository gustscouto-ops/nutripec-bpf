import { exigirCtx } from "@/lib/auth";
import { ErroNegocio } from "@/lib/erros";
import { emitirManual } from "@/lib/servicos/manual-bpf";

export const maxDuration = 300;

/** Emite (ou baixa de novo, se os dados não mudaram) o Manual de BPF da fábrica em PDF. */
export async function GET() {
  const ctx = await exigirCtx("dossie:gerar");
  try {
    const { pdf, nome } = await emitirManual(ctx);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof ErroNegocio) return new Response(e.message, { status: 400 });
    throw e;
  }
}
