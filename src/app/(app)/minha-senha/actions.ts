"use server";

import { prisma } from "@/lib/db";
import { exigirCtx, hashSenha, validarAssinatura } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ErroNegocio, executar } from "@/lib/erros";

/** Troca da própria senha (a mesma usada na assinatura eletrônica dos registros). */
export async function trocarSenha(_: unknown, form: FormData) {
  return executar(async () => {
    const ctx = await exigirCtx();
    const nova = String(form.get("nova") ?? "");
    if (nova.length < 8) throw new ErroNegocio("A nova senha deve ter ao menos 8 caracteres.");
    if (nova !== String(form.get("confirmacao") ?? "")) throw new ErroNegocio("A confirmação não confere com a nova senha.");
    await validarAssinatura(ctx, String(form.get("atual") ?? "")).catch(() => {
      throw new ErroNegocio("Senha atual incorreta.");
    });
    const senhaHash = await hashSenha(nova);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: ctx.userId }, data: { senhaHash } });
      await registrarAuditoria(tx, ctx, { tabela: "users", registroId: ctx.userId, acao: "TROCA_SENHA" });
    });
  }, "Senha alterada. Use a nova senha para entrar e assinar.");
}
