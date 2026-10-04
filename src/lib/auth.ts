import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Perfil } from "@prisma/client";
import { prisma } from "./db";
import { COOKIE_SESSAO, lerSessao, assinarSessao, OPCOES_COOKIE, type DadosSessao } from "./session";
import { pode, type Permissao } from "./permissions";

export type Ctx = {
  userId: string;
  nome: string;
  tenantId: string;
  tenantNome: string;
  perfil: Perfil;
  ip: string | null;
};

export async function sessaoAtual(): Promise<DadosSessao | null> {
  const jar = await cookies();
  return lerSessao(jar.get(COOKIE_SESSAO)?.value);
}

export async function gravarSessao(dados: DadosSessao) {
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, await assinarSessao(dados), OPCOES_COOKIE);
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

async function ipAtual() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/**
 * Contexto do usuário logado na empresa ativa. O perfil é sempre relido do banco
 * (vínculo ativo), para que um acesso revogado deixe de valer imediatamente.
 */
export async function exigirCtx(permissao?: Permissao): Promise<Ctx> {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  if (!s.tid) redirect("/selecionar-empresa");
  const vinculo = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: s.uid, tenantId: s.tid } },
    include: { tenant: true, user: true },
  });
  if (!vinculo || !vinculo.ativo || !vinculo.user.ativo) redirect("/login?erro=acesso");
  const ctx: Ctx = {
    userId: s.uid,
    nome: vinculo.user.nome,
    tenantId: s.tid,
    tenantNome: vinculo.tenant.nomeFantasia ?? vinculo.tenant.razaoSocial,
    perfil: vinculo.perfil,
    ip: await ipAtual(),
  };
  if (permissao && !pode(ctx.perfil, permissao)) {
    throw new Error("Seu perfil não tem permissão para esta ação.");
  }
  return ctx;
}

/**
 * Assinatura eletrônica: confirma a senha do próprio usuário logado antes de fechar um registro.
 */
export async function validarAssinatura(ctx: Ctx, senha: string) {
  if (!senha) throw new Error("Informe sua senha para assinar.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) {
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userNome: ctx.nome,
        tabelaAfetada: "users",
        registroId: ctx.userId,
        acao: "ASSINATURA_RECUSADA",
        ip: ctx.ip,
      },
    });
    throw new Error("Senha incorreta. Assinatura não realizada.");
  }
  return user;
}

export function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}
