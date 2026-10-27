import { exigirCtx } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { pdfFormulariosEmBranco } from "@/lib/pdf/rq";
import { modelosEfetivos } from "@/lib/servicos/rq";

/** Todos os RQs ativos em branco num PDF só: de um POP (?pop=6) ou de todos os POPs. */
export async function GET(req: Request) {
  const ctx = await exigirCtx();
  const pop = Number(new URL(req.url).searchParams.get("pop")) || null;
  const modelos = (await modelosEfetivos(ctx.tenantId)).filter((m) => !pop || m.pop.numeroPop === pop);
  if (!modelos.length) return new Response("Nenhum RQ ativo", { status: 404 });
  const rotulo = pop ? `POP ${String(pop).padStart(2, "0")}` : "todos os POPs";
  const pdf = await pdfFormulariosEmBranco(ctx.tenantId, modelos, `RQs em branco - ${rotulo}`);
  await registrarAuditoria(prisma, ctx, { tabela: "rqModelo", registroId: pop ? `POP ${pop}` : "todos", acao: "EMISSAO_FORMULARIO", depois: modelos.map((m) => `${m.codigoRq} rev. ${m.versao}`) });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="RQs-em-branco-${pop ? `POP-${String(pop).padStart(2, "0")}` : "todos"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
