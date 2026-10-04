"use server";

import { revalidatePath } from "next/cache";
import type { Perfil } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigirCtx, hashSenha } from "@/lib/auth";
import { atualizarAuditado, criarAuditado, registrarAuditoria } from "@/lib/audit";
import { ErroNegocio, executar } from "@/lib/erros";

const PERFIS: Perfil[] = ["CEO", "RT", "CONSULTOR", "OPERADOR", "AUDITOR"];

export async function adicionarUsuario(_: unknown, form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("usuarios:gerenciar");
    const nome = String(form.get("nome") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const senha = String(form.get("senha") ?? "");
    const perfil = String(form.get("perfil")) as Perfil;
    const cargo = String(form.get("cargo") ?? "").trim() || null;
    const registroProfissional = String(form.get("registroProfissional") ?? "").trim() || null;
    if (!PERFIS.includes(perfil)) throw new ErroNegocio("Perfil inválido.");
    if (!email) throw new ErroNegocio("Informe o e-mail.");
    await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        if (!nome) throw new ErroNegocio("Informe o nome.");
        if (senha.length < 8) throw new ErroNegocio("A senha inicial deve ter ao menos 8 caracteres.");
        const senhaHash = await hashSenha(senha);
        user = await tx.user.create({ data: { nome, email, senhaHash, registroProfissional } });
        const { senhaHash: _omitido, ...semSenha } = user;
        await registrarAuditoria(tx, ctx, { tabela: "user", registroId: user.id, acao: "CREATE", depois: semSenha });
      }
      const existente = await tx.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: ctx.tenantId } } });
      if (existente) throw new ErroNegocio("Este usuário já tem acesso a esta empresa.");
      await criarAuditado(tx, ctx, "membership", { userId: user.id, tenantId: ctx.tenantId, perfil, cargo });
    });
  }, "Usuário adicionado.");
  if (r.ok) revalidatePath("/usuarios");
  return r;
}

export async function alternarAcesso(membershipId: string) {
  const ctx = await exigirCtx("usuarios:gerenciar");
  await prisma.$transaction(async (tx) => {
    const m = await tx.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenantId } });
    if (!m || m.userId === ctx.userId) return;
    await atualizarAuditado(tx, ctx, "membership", m.id, { ativo: !m.ativo });
  });
  revalidatePath("/usuarios");
}

/** Quem recebe o resumo diário de pendências (e-mail sempre; WhatsApp quando houver telefone). */
export async function salvarAlertas(membershipId: string, form: FormData) {
  const ctx = await exigirCtx("usuarios:gerenciar");
  const telefone = String(form.get("telefone") ?? "").replace(/\D/g, "") || null;
  const receberAlertas = form.get("receberAlertas") === "on";
  await prisma.$transaction(async (tx) => {
    const m = await tx.membership.findFirst({ where: { id: membershipId, tenantId: ctx.tenantId } });
    if (!m) return;
    await atualizarAuditado(tx, ctx, "membership", m.id, { receberAlertas });
    const u = await tx.user.findUniqueOrThrow({ where: { id: m.userId }, select: { telefone: true } });
    if (u.telefone !== telefone) {
      await tx.user.update({ where: { id: m.userId }, data: { telefone } });
      await registrarAuditoria(tx, ctx, { tabela: "user", registroId: m.userId, acao: "UPDATE", antes: { telefone: u.telefone }, depois: { telefone } });
    }
  });
  revalidatePath("/usuarios");
}
