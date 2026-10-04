"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encerrarSessao, gravarSessao, sessaoAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

export async function entrar(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { ativo: true }, include: { tenant: true } } },
  });
  const ok = user && user.ativo && (await bcrypt.compare(senha, user.senhaHash));
  if (!ok || !user) return { erro: "E-mail ou senha inválidos." };
  if (!user.memberships.length) return { erro: "Seu usuário não está vinculado a nenhuma empresa." };

  const unica = user.memberships.length === 1 ? user.memberships[0] : null;
  await gravarSessao({ uid: user.id, nome: user.nome, tid: unica?.tenantId, perfil: unica?.perfil });
  await registrarAuditoria(prisma, { tenantId: unica?.tenantId ?? null, userId: user.id, nome: user.nome, ip: null }, {
    tabela: "users",
    registroId: user.id,
    acao: "LOGIN",
  });
  redirect(unica ? "/" : "/selecionar-empresa");
}

export async function escolherEmpresa(tenantId: string) {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  const vinculo = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: s.uid, tenantId } } });
  if (!vinculo?.ativo) redirect("/selecionar-empresa");
  await gravarSessao({ uid: s.uid, nome: s.nome, tid: tenantId, perfil: vinculo.perfil });
  redirect("/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
