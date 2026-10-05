"use server";

import { revalidatePath } from "next/cache";
import { exigirCtx } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { salvarDadosManual } from "@/lib/servicos/manual-bpf";
import { CAMPOS_EDITAVEIS } from "./campos";

export async function salvarManual(_: unknown, form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("empresa:configurar");
    const dados = Object.fromEntries(CAMPOS_EDITAVEIS.map((c) => [c, String(form.get(c) ?? "")]));
    await salvarDadosManual(ctx, dados as Parameters<typeof salvarDadosManual>[1]);
  }, "Dados do manual salvos.");
  if (r.ok) revalidatePath("/manual-bpf");
  return r;
}
