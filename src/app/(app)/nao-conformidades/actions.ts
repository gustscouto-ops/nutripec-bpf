"use server";

import { revalidatePath } from "next/cache";
import type { GravidadeNc } from "@prisma/client";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { executar } from "@/lib/erros";
import { abrirNc, cancelarNc, registrarAcaoExecutada, registrarPlano, verificarEficacia, type NcManualInput } from "@/lib/servicos/nc";

const atualizar = (id?: string) => {
  revalidatePath("/nao-conformidades");
  if (id) revalidatePath(`/nao-conformidades/${id}`);
};

export async function acaoAbrirNc(input: NcManualInput) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    return (await abrirNc(ctx, input)).id;
  });
  if (r.ok) atualizar();
  return r;
}

export async function acaoPlano(id: string, input: { causaRaiz: string; acaoPreventiva: string; responsavelAcao: string; prazo: string; gravidade?: GravidadeNc }) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("nc:tratar");
    await registrarPlano(ctx, id, input);
  }, "Plano de ação registrado.");
  if (r.ok) atualizar(id);
  return r;
}

export async function acaoExecutada(id: string, descricao: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    await registrarAcaoExecutada(ctx, id, descricao);
  }, "Execução registrada. Aguardando verificação de eficácia.");
  if (r.ok) atualizar(id);
  return r;
}

export async function acaoVerificar(id: string, eficaz: boolean, verificacao: string, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("nc:encerrar");
    await validarAssinatura(ctx, senha);
    await verificarEficacia(ctx, id, eficaz, verificacao);
  }, eficaz ? "NC encerrada e assinada." : "Ação ineficaz registrada: defina um novo plano.");
  if (r.ok) atualizar(id);
  return r;
}

export async function acaoCancelar(id: string, motivo: string, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("nc:encerrar");
    await validarAssinatura(ctx, senha);
    await cancelarNc(ctx, id, motivo);
  }, "NC cancelada.");
  if (r.ok) atualizar(id);
  return r;
}
