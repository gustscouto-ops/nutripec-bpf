import { exigirCtx } from "@/lib/auth";
import { prisma, num } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { paresHomologados, CODIGO_RQ_RECEBIMENTO, MAX_FOTOS } from "@/lib/servicos/recebimento";
import type { CampoRq } from "@/lib/rq/campos";
import { Alerta } from "@/components/ui";
import { FormRecebimento } from "./form";

export const metadata = { title: "Recebimento de carga" };

export default async function NovoRecebimento() {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "operacao:registrar")) return <Alerta>Seu perfil não registra recebimentos.</Alerta>;
  const [pares, modelo, tenant] = await Promise.all([
    paresHomologados(ctx.tenantId),
    prisma.rqModelo.findUniqueOrThrow({ where: { codigoRq: CODIGO_RQ_RECEBIMENTO }, include: { pop: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
  ]);
  const opcoes = pares.map((p) => ({
    fornecedorId: p.fornecedorId,
    fornecedor: p.fornecedor.razaoSocial,
    cnpj: p.fornecedor.cnpj,
    materiaPrimaId: p.materiaPrimaId,
    materiaPrima: p.materiaPrima.nomeComercial,
    prefixo: p.materiaPrima.prefixoLote,
    umidadeMaxPct: p.materiaPrima.umidadeMaxPct === null ? null : num(p.materiaPrima.umidadeMaxPct),
    temperaturaMaxC: p.materiaPrima.temperaturaMaxC === null ? null : num(p.materiaPrima.temperaturaMaxC),
  }));
  return (
    <FormRecebimento
      opcoes={opcoes}
      campos={modelo.campos as unknown as CampoRq[]}
      titulo={`POP 0${modelo.pop.numeroPop} · ${modelo.codigoRq} — ${modelo.titulo}`}
      regraLote={tenant.regraLoteMp}
      maxFotos={MAX_FOTOS}
      usuario={ctx.nome}
      chaveRascunho={`rascunho-rq12-${ctx.tenantId}-${ctx.userId}`}
    />
  );
}
