import { exigirCtx } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { csv } from "@/lib/csv";
import type { ResultadoRecall } from "@/lib/servicos/recall";

/** Lista de clientes a notificar, uma linha por nota fiscal. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const r = await prisma.recallRegistro.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!r) return new Response("Não encontrado", { status: 404 });
  const res = r.resultado as unknown as ResultadoRecall;
  const linhas = [["Cliente", "Documento", "Cidade/UF", "NF", "Data", "Lote", "Sacas", "Placa"]];
  for (const c of res.clientes) {
    for (const e of c.envios) {
      linhas.push([c.nome, c.documento ?? "", c.cidadeUf ?? "", e.nf, new Date(e.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), e.lote, String(e.sacas), e.placa ?? ""]);
    }
  }
  await registrarAuditoria(prisma, ctx, { tabela: "recall", registroId: id, acao: "EXPORTACAO_CLIENTES" });
  return new Response(csv(linhas), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="recall-${String(r.numero).padStart(4, "0")}-clientes.csv"` },
  });
}
