import { exigirCtx } from "@/lib/auth";
import { prisma, num } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { lotesDisponiveis, TOLERANCIA_DESVIO_PCT } from "@/lib/servicos/producao";
import { Alerta } from "@/components/ui";
import { FormOrdem } from "./form";

export const metadata = { title: "Nova ordem de produção" };

export default async function NovaOrdem() {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "operacao:registrar")) return <Alerta>Seu perfil não registra produção.</Alerta>;
  const produtos = await prisma.produto.findMany({
    where: { tenantId: ctx.tenantId, ativo: true, statusFormula: "APROVADA" },
    include: { itens: { include: { materiaPrima: { select: { nomeComercial: true } } }, orderBy: { ordemDosagem: "asc" } } },
    orderBy: { codigo: "asc" },
  });
  const pendentes = await prisma.produto.count({ where: { tenantId: ctx.tenantId, ativo: true, statusFormula: { not: "APROVADA" } } });
  const lotes = await lotesDisponiveis(ctx.tenantId, [...new Set(produtos.flatMap((p) => p.itens.map((i) => i.materiaPrimaId)))]);
  return (
    <FormOrdem
      produtos={produtos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        versao: p.versaoFormula,
        bateladaKg: num(p.tamanhoBateladaKg),
        sacariaKg: num(p.pesoSacariaKg),
        itens: p.itens.map((i) => ({ materiaPrimaId: i.materiaPrimaId, nome: i.materiaPrima.nomeComercial, kgBatelada: num(i.quantidadeBateladaKg) })),
      }))}
      lotes={lotes}
      tolerancia={TOLERANCIA_DESVIO_PCT}
      usuario={ctx.nome}
      pendentes={pendentes}
    />
  );
}
