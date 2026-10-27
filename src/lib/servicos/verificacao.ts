import type { RqVerificacao } from "@prisma/client";
import { prisma } from "../db";
import { registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import type { Ctx } from "../auth";

/**
 * Verificação dos registros (IN 04/2007, 7.2, 7.3 e 7.15): depois que o monitor assina o RQ,
 * uma segunda pessoa (RT ou consultor) confere e assina eletronicamente. A verificação fica em
 * tabela própria e imutável, porque o registro do monitor não pode ser alterado depois de assinado.
 */
export async function verificarRq(ctx: Ctx, rqExecucaoId: string, parecer?: string | null, agora = new Date()): Promise<RqVerificacao> {
  const rq = await prisma.rqExecucao.findFirst({ where: { id: rqExecucaoId, tenantId: ctx.tenantId }, include: { verificacao: true } });
  if (!rq) throw new ErroNegocio("Registro não encontrado.");
  if (rq.verificacao) throw new ErroNegocio(`Este registro já foi verificado por ${rq.verificacao.nome}.`);
  if (rq.userIdAssinatura === ctx.userId) {
    throw new ErroNegocio("A verificação precisa ser feita por outra pessoa, não por quem monitorou e assinou o registro.");
  }
  const texto = parecer?.trim() || null;
  if (rq.status === "NAO_CONFORME" && (!texto || texto.length < 5)) {
    throw new ErroNegocio("Registro com não conformidade: escreva o parecer da verificação (ação corretiva conferida, produto, medidas preventivas).");
  }
  const usuario = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { registroProfissional: true } });
  const conteudo = {
    rq: { id: rq.id, codigoRq: rq.codigoRq, numero: rq.numero, hashAssinatura: rq.hashAssinatura },
    verificador: { id: ctx.userId, nome: ctx.nome, perfil: ctx.perfil },
    dataHora: agora.toISOString(),
    parecer: texto,
  };
  return prisma.$transaction(async (tx) => {
    const v = await tx.rqVerificacao.create({
      data: {
        tenantId: ctx.tenantId,
        rqExecucaoId: rq.id,
        userId: ctx.userId,
        nome: ctx.nome,
        perfil: ctx.perfil,
        registroProfissional: usuario?.registroProfissional ?? null,
        dataHora: agora,
        parecer: texto,
        hash: hashAssinatura(conteudo),
        ip: ctx.ip,
      },
    });
    await registrarAuditoria(tx, ctx, { tabela: "rqVerificacao", registroId: v.id, acao: "VERIFICACAO", depois: v });
    return v;
  });
}
