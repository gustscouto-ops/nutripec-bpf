"use server";

import { revalidatePath } from "next/cache";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigirCtx } from "@/lib/auth";
import { atualizarAuditado } from "@/lib/audit";
import { ErroNegocio, executar } from "@/lib/erros";
import { enviarAlertas } from "@/lib/servicos/alertas";

export async function salvarEmpresa(_: unknown, form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("empresa:configurar");
    const t = (k: string) => String(form.get(k) ?? "").trim() || null;
    const regraLoteMp = t("regraLoteMp");
    const regraLoteProd = t("regraLoteProd");
    if (!regraLoteMp?.includes("{PREFIXO}")) throw new ErroNegocio("A regra do lote de matéria-prima precisa conter {PREFIXO}.");
    if (!regraLoteProd?.includes("{CODIGO}")) throw new ErroNegocio("A regra do lote de produto precisa conter {CODIGO}.");
    await prisma.$transaction((tx) =>
      atualizarAuditado<Tenant>(tx, ctx, "tenant", ctx.tenantId, {
        razaoSocial: t("razaoSocial") ?? undefined,
        nomeFantasia: t("nomeFantasia"),
        registroMapa: t("registroMapa"),
        endereco: t("endereco"),
        cidadeUf: t("cidadeUf"),
        regraLoteMp,
        regraLoteProd,
      }),
    );
  }, "Configurações salvas.");
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

/** Dispara agora o resumo de pendências desta empresa (ignora o limite de um envio por dia). */
export async function acaoTestarAlertas() {
  return executar(async () => {
    const ctx = await exigirCtx("empresa:configurar");
    const relatorio = await enviarAlertas({ tenantId: ctx.tenantId, forcar: true });
    revalidatePath("/configuracoes");
    return relatorio.length;
  });
}
