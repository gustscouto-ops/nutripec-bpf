"use server";

import { revalidatePath } from "next/cache";
import type { Frequencia } from "@prisma/client";
import { exigirCtx } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { criarIt, criarModelo, salvarIt, salvarModelo, type ItInput, type ModeloInput } from "@/lib/servicos/modelos";

function revalidar() {
  revalidatePath("/pops");
  revalidatePath("/tarefas");
}

export async function acaoSalvarModelo(id: string, input: ModeloInput) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("formulario:customizar");
    const m = await salvarModelo(ctx, id, input);
    return { id: m.id, versao: m.versao };
  });
  if (r.ok) revalidar();
  return r;
}

export async function acaoCriarModelo(input: { popId: string; codigoRq: string; titulo: string; frequencia: Frequencia }) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("formulario:customizar");
    return { id: (await criarModelo(ctx, input)).id };
  });
  if (r.ok) revalidar();
  return r;
}

export async function acaoSalvarIt(id: string, input: ItInput) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("formulario:customizar");
    const it = await salvarIt(ctx, id, input);
    return { id: it.id, versao: it.versao };
  });
  if (r.ok) revalidar();
  return r;
}

export async function acaoCriarIt(input: { popId: string; titulo: string }) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("formulario:customizar");
    return { id: (await criarIt(ctx, input)).id };
  });
  if (r.ok) revalidar();
  return r;
}
