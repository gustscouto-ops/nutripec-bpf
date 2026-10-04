"use server";

import { revalidatePath } from "next/cache";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { aprovarFormula, salvarProduto, type ProdutoInput } from "@/lib/servicos/formula";

export async function acaoSalvarProduto(id: string | null, input: ProdutoInput) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("cadastros:editar");
    const p = await salvarProduto(ctx, id, input);
    return p.id;
  });
  if (r.ok) revalidatePath("/produtos");
  return r;
}

export async function acaoAprovarFormula(produtoId: string, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("formula:aprovar");
    await validarAssinatura(ctx, senha);
    await aprovarFormula(ctx, produtoId);
  }, "Fórmula aprovada e assinada.");
  if (r.ok) revalidatePath(`/produtos/${produtoId}`);
  return r;
}
