import { exigirCtx } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ErroNegocio } from "@/lib/erros";
import { gerarZpl, TAMANHOS, type Tamanho } from "@/lib/rotulo";
import { dadosRotulo } from "@/lib/servicos/rotulagem";

/** Arquivo ZPL da etiqueta (modelo do produto ou lote produzido). Só sai para fórmula aprovada pelo RT. */
export async function GET(req: Request) {
  const ctx = await exigirCtx("operacao:registrar");
  const u = new URL(req.url).searchParams;
  const tamanho = (u.get("tamanho") ?? "100x150") as Tamanho;
  if (!(tamanho in TAMANHOS)) return new Response("Tamanho inválido", { status: 400 });
  let r;
  try {
    r = await dadosRotulo(ctx.tenantId, u.get("ordem") ? { ordemId: u.get("ordem")! } : { produtoId: u.get("produto") ?? "" });
  } catch (e) {
    if (e instanceof ErroNegocio) return new Response(e.message, { status: 404 });
    throw e;
  }
  if (!r.aprovada) return new Response("Fórmula sem aprovação do RT: etiqueta bloqueada.", { status: 409 });
  const copias = Number(u.get("copias") ?? 1) || 1;
  const { zpl, cabe } = gerarZpl(r.dados, { tamanho, dpi: u.get("dpi") === "300" ? 300 : 203, copias });
  await registrarAuditoria(prisma, ctx, {
    tabela: r.ordem ? "producaoOrdem" : "produto",
    registroId: r.ordem?.id ?? r.produto.id,
    acao: "EMISSAO_ETIQUETA",
    depois: { tamanho, copias, versaoFormula: r.produto.versaoFormula, lote: r.ordem?.codigoLoteProduzido ?? null },
  });
  const nome = `${r.produto.codigo}${r.ordem ? `-${r.ordem.codigoLoteProduzido}` : "-modelo"}.zpl`.replace(/[^\w.-]/g, "_");
  return new Response(zpl, {
    headers: { "Content-Type": "application/zpl; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"`, "X-Etiqueta-Cabe": String(cabe), "Cache-Control": "no-store" },
  });
}
