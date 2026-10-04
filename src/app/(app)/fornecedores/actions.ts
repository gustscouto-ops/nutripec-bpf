"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Fornecedor, StatusQualificacao } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigirCtx } from "@/lib/auth";
import { atualizarAuditado, criarAuditado, registrarAuditoria } from "@/lib/audit";
import { ErroNegocio, executar } from "@/lib/erros";

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
};

export async function salvarFornecedor(id: string | null, _: unknown, form: FormData) {
  const resultado = await executar(async () => {
    const ctx = await exigirCtx("cadastros:editar");
    const razaoSocial = texto(form, "razaoSocial");
    const cnpj = texto(form, "cnpj");
    if (!razaoSocial || !cnpj) throw new ErroNegocio("Razão social e CNPJ são obrigatórios.");
    const status = (texto(form, "statusQualificacao") ?? "EM_AVALIACAO") as StatusQualificacao;
    const vinculos = form.getAll("mp").map(String);
    const homologados = new Set(form.getAll("homologado").map(String));
    const mpsValidas = await prisma.materiaPrima.count({ where: { tenantId: ctx.tenantId, id: { in: vinculos } } });
    if (mpsValidas !== vinculos.length) throw new ErroNegocio("Matéria-prima inválida.");

    const dados = {
      razaoSocial,
      nomeFantasia: texto(form, "nomeFantasia"),
      cnpj,
      registroMapa: texto(form, "registroMapa"),
      contato: texto(form, "contato"),
      email: texto(form, "email"),
      telefone: texto(form, "telefone"),
      cidadeUf: texto(form, "cidadeUf"),
      statusQualificacao: status,
      observacoes: texto(form, "observacoes"),
      ativo: form.get("ativo") !== null,
    };

    return prisma.$transaction(async (tx) => {
      let fornecedor: Fornecedor;
      if (id) {
        const atual = await tx.fornecedor.findFirst({ where: { id, tenantId: ctx.tenantId } });
        if (!atual) throw new ErroNegocio("Fornecedor não encontrado.");
        fornecedor = await atualizarAuditado<Fornecedor>(tx, ctx, "fornecedor", id, {
          ...dados,
          dataQualificacao: status !== atual.statusQualificacao ? new Date() : atual.dataQualificacao,
        });
      } else {
        fornecedor = await criarAuditado<Fornecedor>(tx, ctx, "fornecedor", {
          ...dados,
          tenantId: ctx.tenantId,
          dataQualificacao: status === "EM_AVALIACAO" ? null : new Date(),
        });
      }
      const antes = await tx.fornecedorMateriaPrima.findMany({ where: { fornecedorId: fornecedor.id } });
      await tx.fornecedorMateriaPrima.deleteMany({ where: { fornecedorId: fornecedor.id } });
      const depois = vinculos.map((m) => ({ fornecedorId: fornecedor.id, materiaPrimaId: m, homologado: homologados.has(m) }));
      await tx.fornecedorMateriaPrima.createMany({ data: depois });
      await registrarAuditoria(tx, ctx, { tabela: "fornecedorMateriaPrima", registroId: fornecedor.id, acao: "UPDATE", antes, depois });
      return fornecedor.id;
    });
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/fornecedores");
  redirect(`/fornecedores/${resultado.dados}?salvo=1`);
}
