import { Prisma } from "@prisma/client";
import { plain, type Tx } from "./db";
import type { Ctx } from "./auth";

/**
 * Trilha de auditoria. Toda escrita em dados regulatórios passa por estes helpers,
 * dentro da mesma transação, registrando quem, quando, o valor anterior e o novo.
 * A tabela audit_logs é imutável (trigger no banco bloqueia UPDATE/DELETE).
 */

type Delegate = {
  create(args: { data: unknown }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: unknown }): Promise<{ id: string }>;
  findUnique(args: { where: { id: string } }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<{ id: string }>;
};

export type ModeloAuditado = Uncapitalize<Prisma.ModelName>;

function delegate(tx: Tx, modelo: ModeloAuditado): Delegate {
  return (tx as unknown as Record<string, Delegate>)[modelo];
}

export async function registrarAuditoria(
  tx: Tx,
  ctx: { tenantId: string | null; userId: string | null; nome: string | null; ip: string | null } | null,
  entrada: {
    tabela: string;
    registroId: string;
    acao: string;
    antes?: unknown;
    depois?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: ctx?.tenantId ?? null,
      userId: ctx?.userId ?? null,
      userNome: ctx?.nome ?? null,
      tabelaAfetada: entrada.tabela,
      registroId: entrada.registroId,
      acao: entrada.acao,
      dadosAnteriores: entrada.antes === undefined ? Prisma.JsonNull : (plain(entrada.antes) as Prisma.InputJsonValue),
      dadosNovos: entrada.depois === undefined ? Prisma.JsonNull : (plain(entrada.depois) as Prisma.InputJsonValue),
      ip: ctx?.ip ?? null,
    },
  });
}

export async function criarAuditado<T extends { id: string }>(
  tx: Tx,
  ctx: Ctx,
  modelo: ModeloAuditado,
  data: Record<string, unknown>,
  acao = "CREATE",
): Promise<T> {
  const novo = (await delegate(tx, modelo).create({ data })) as T;
  await registrarAuditoria(tx, ctx, { tabela: modelo, registroId: novo.id, acao, depois: novo });
  return novo;
}

export async function atualizarAuditado<T extends { id: string }>(
  tx: Tx,
  ctx: Ctx,
  modelo: ModeloAuditado,
  id: string,
  data: Record<string, unknown>,
  acao = "UPDATE",
): Promise<T> {
  const antes = await delegate(tx, modelo).findUnique({ where: { id } });
  if (!antes) throw new Error("Registro não encontrado");
  const depois = (await delegate(tx, modelo).update({ where: { id }, data })) as T;
  await registrarAuditoria(tx, ctx, { tabela: modelo, registroId: id, acao, antes, depois });
  return depois;
}

export async function excluirAuditado(tx: Tx, ctx: Ctx, modelo: ModeloAuditado, id: string) {
  const antes = await delegate(tx, modelo).findUnique({ where: { id } });
  if (!antes) throw new Error("Registro não encontrado");
  await delegate(tx, modelo).delete({ where: { id } });
  await registrarAuditoria(tx, ctx, { tabela: modelo, registroId: id, acao: "DELETE", antes });
}
