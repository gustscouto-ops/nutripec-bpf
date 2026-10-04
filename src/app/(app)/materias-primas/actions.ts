"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CategoriaMp, MateriaPrima, UnidadeMedida } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigirCtx } from "@/lib/auth";
import { atualizarAuditado, criarAuditado } from "@/lib/audit";
import { ErroNegocio, executar } from "@/lib/erros";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const decimal = (f: FormData, k: string) => {
  const v = texto(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  if (Number.isNaN(n)) throw new ErroNegocio(`Valor inválido em ${k}.`);
  return n;
};

export async function salvarMateriaPrima(id: string | null, _: unknown, form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("cadastros:editar");
    const nomeComercial = texto(form, "nomeComercial");
    const prefixoLote = texto(form, "prefixoLote")?.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!nomeComercial || !prefixoLote) throw new ErroNegocio("Nome comercial e prefixo do lote são obrigatórios.");
    const dados = {
      codigo: texto(form, "codigo"),
      nomeComercial,
      nomeTecnico: texto(form, "nomeTecnico"),
      prefixoLote,
      categoria: texto(form, "categoria") as CategoriaMp,
      unidadeMedida: (texto(form, "unidadeMedida") ?? "KG") as UnidadeMedida,
      pesoEmbalagemKg: decimal(form, "pesoEmbalagemKg"),
      umidadeMaxPct: decimal(form, "umidadeMaxPct"),
      temperaturaMaxC: decimal(form, "temperaturaMaxC"),
      ativo: form.get("ativo") !== null,
    };
    return prisma.$transaction(async (tx) => {
      if (id) {
        const atual = await tx.materiaPrima.findFirst({ where: { id, tenantId: ctx.tenantId } });
        if (!atual) throw new ErroNegocio("Matéria-prima não encontrada.");
        return (await atualizarAuditado<MateriaPrima>(tx, ctx, "materiaPrima", id, dados)).id;
      }
      return (await criarAuditado<MateriaPrima>(tx, ctx, "materiaPrima", { ...dados, tenantId: ctx.tenantId })).id;
    });
  });
  if (!r.ok) return r;
  revalidatePath("/materias-primas");
  redirect("/materias-primas");
}
