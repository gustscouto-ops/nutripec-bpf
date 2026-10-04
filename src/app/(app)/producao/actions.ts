"use server";

import { revalidatePath } from "next/cache";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { registrarExpedicao, registrarOrdem, type ExpedicaoInput, type OrdemInput } from "@/lib/servicos/producao";

export async function acaoRegistrarOrdem(input: OrdemInput, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    await validarAssinatura(ctx, senha);
    const ordem = await registrarOrdem(ctx, input);
    return { id: ordem.id };
  });
  if (r.ok) revalidatePath("/producao");
  return r;
}

export async function acaoRegistrarExpedicao(input: ExpedicaoInput) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    await registrarExpedicao(ctx, input);
  }, "Expedição registrada.");
  if (r.ok) revalidatePath("/expedicao");
  return r;
}
