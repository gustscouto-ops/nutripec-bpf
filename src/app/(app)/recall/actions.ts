"use server";

import { revalidatePath } from "next/cache";
import type { AlvoRecall, TipoRecall } from "@prisma/client";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { registrarRecall } from "@/lib/servicos/recall";

export async function acaoRegistrarRecall(input: { tipo: TipoRecall; alvoTipo: AlvoRecall; alvoId: string; motivo: string; iniciadoEm: number }, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("recall:registrar");
    await validarAssinatura(ctx, senha);
    const { registro } = await registrarRecall(ctx, { ...input, iniciadoEm: new Date(input.iniciadoEm) });
    return { id: registro.id };
  });
  if (r.ok) {
    revalidatePath("/recall");
    revalidatePath("/tarefas");
  }
  return r;
}
