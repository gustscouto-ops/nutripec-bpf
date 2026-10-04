import type { GravidadeNc, NaoConformidade, OrigemNc } from "@prisma/client";
import { prisma } from "../db";
import { atualizarAuditado, criarAuditado } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import { deChave } from "../agenda";
import type { Ctx } from "../auth";

/**
 * Tratamento de não conformidades:
 * ABERTA (ação imediata) → EM_TRATAMENTO (causa raiz + ação preventiva) →
 * AGUARDANDO_VERIFICACAO (ação executada) → ENCERRADA (eficácia verificada e assinada pelo RT).
 * Se a verificação concluir que a ação não foi eficaz, a NC volta para EM_TRATAMENTO.
 */

const MIN = 5;
const exigir = (v: string | null | undefined, rotulo: string) => {
  const t = (v ?? "").trim();
  if (t.length < MIN) throw new ErroNegocio(`Preencha: ${rotulo}.`);
  return t;
};

async function carregar(ctx: Ctx, id: string) {
  const nc = await prisma.naoConformidade.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!nc) throw new ErroNegocio("Não conformidade não encontrada.");
  return nc;
}

export type NcManualInput = {
  origem: Exclude<OrigemNc, "RQ">;
  titulo: string;
  descricao: string;
  acaoImediata: string;
  gravidade: GravidadeNc;
  popNumero?: number | null;
  fornecedorId?: string | null;
  loteReferencia?: string | null;
};

export async function abrirNc(ctx: Ctx, input: NcManualInput) {
  const titulo = exigir(input.titulo, "título");
  const descricao = exigir(input.descricao, "descrição do ocorrido");
  const acaoImediata = exigir(input.acaoImediata, "ação imediata");
  if (input.fornecedorId) {
    const f = await prisma.fornecedor.count({ where: { id: input.fornecedorId, tenantId: ctx.tenantId } });
    if (!f) throw new ErroNegocio("Fornecedor inválido.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.tenantId}|NC`}))`;
    const ultimo = await tx.naoConformidade.aggregate({ where: { tenantId: ctx.tenantId }, _max: { numero: true } });
    return criarAuditado<NaoConformidade>(tx, ctx, "naoConformidade", {
      tenantId: ctx.tenantId,
      numero: (ultimo._max.numero ?? 0) + 1,
      origem: input.origem,
      titulo,
      descricao,
      acaoImediata,
      gravidade: input.gravidade,
      popNumero: input.popNumero || null,
      fornecedorId: input.fornecedorId || null,
      loteReferencia: input.loteReferencia?.trim() || null,
      abertaPorId: ctx.userId,
      abertaPorNome: ctx.nome,
    });
  });
}

export async function registrarPlano(
  ctx: Ctx,
  id: string,
  input: { causaRaiz: string; acaoPreventiva: string; responsavelAcao: string; prazo: string; gravidade?: GravidadeNc },
) {
  const nc = await carregar(ctx, id);
  if (!["ABERTA", "EM_TRATAMENTO"].includes(nc.status)) throw new ErroNegocio("O plano só pode ser definido em NC aberta ou em tratamento.");
  if (!input.prazo) throw new ErroNegocio("Informe o prazo da ação preventiva.");
  return prisma.$transaction((tx) =>
    atualizarAuditado<NaoConformidade>(
      tx,
      ctx,
      "naoConformidade",
      id,
      {
        causaRaiz: exigir(input.causaRaiz, "causa raiz"),
        acaoPreventiva: exigir(input.acaoPreventiva, "ação preventiva"),
        responsavelAcao: exigir(input.responsavelAcao, "responsável").slice(0, 120),
        prazo: deChave(input.prazo),
        gravidade: input.gravidade ?? nc.gravidade,
        planoPorNome: ctx.nome,
        planoEm: new Date(),
        status: "EM_TRATAMENTO",
      },
      "NC_PLANO",
    ),
  );
}

export async function registrarAcaoExecutada(ctx: Ctx, id: string, descricao: string) {
  const nc = await carregar(ctx, id);
  if (nc.status !== "EM_TRATAMENTO") throw new ErroNegocio("Defina o plano de ação antes de registrar a execução.");
  return prisma.$transaction((tx) =>
    atualizarAuditado<NaoConformidade>(
      tx,
      ctx,
      "naoConformidade",
      id,
      { execucaoDescricao: exigir(descricao, "o que foi feito"), executadaPorNome: ctx.nome, executadaEm: new Date(), status: "AGUARDANDO_VERIFICACAO" },
      "NC_EXECUCAO",
    ),
  );
}

/** Verificação de eficácia assinada pelo RT. Eficaz → ENCERRADA (imutável); ineficaz → volta ao tratamento. */
export async function verificarEficacia(ctx: Ctx, id: string, eficaz: boolean, verificacao: string) {
  const nc = await carregar(ctx, id);
  if (nc.status !== "AGUARDANDO_VERIFICACAO") throw new ErroNegocio("A NC não está aguardando verificação de eficácia.");
  const texto = exigir(verificacao, "evidência da verificação");
  const agora = new Date();
  return prisma.$transaction((tx) =>
    atualizarAuditado<NaoConformidade>(
      tx,
      ctx,
      "naoConformidade",
      id,
      eficaz
        ? {
            verificacaoEficacia: texto,
            eficaz: true,
            status: "ENCERRADA",
            encerradaPorId: ctx.userId,
            encerradaPorNome: ctx.nome,
            encerradaEm: agora,
            hashEncerramento: hashAssinatura({ ...nc, verificacaoEficacia: texto, eficaz: true, encerradaPor: ctx.userId, encerradaEm: agora.toISOString() }),
          }
        : {
            // ação ineficaz: registra a verificação e reabre o tratamento para um novo plano
            verificacaoEficacia: `INEFICAZ (${ctx.nome}, ${agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}): ${texto}`,
            eficaz: false,
            status: "EM_TRATAMENTO",
            execucaoDescricao: null,
            executadaPorNome: null,
            executadaEm: null,
          },
      eficaz ? "NC_ENCERRAMENTO" : "NC_INEFICAZ",
    ),
  );
}

export async function cancelarNc(ctx: Ctx, id: string, motivo: string) {
  const nc = await carregar(ctx, id);
  if (["ENCERRADA", "CANCELADA"].includes(nc.status)) throw new ErroNegocio("NC já finalizada.");
  return prisma.$transaction((tx) =>
    atualizarAuditado<NaoConformidade>(
      tx,
      ctx,
      "naoConformidade",
      id,
      {
        status: "CANCELADA",
        verificacaoEficacia: `Cancelada: ${exigir(motivo, "justificativa do cancelamento")}`,
        encerradaPorId: ctx.userId,
        encerradaPorNome: ctx.nome,
        encerradaEm: new Date(),
      },
      "NC_CANCELAMENTO",
    ),
  );
}

export const ROTULO_STATUS_NC = {
  ABERTA: "Aberta",
  EM_TRATAMENTO: "Em tratamento",
  AGUARDANDO_VERIFICACAO: "Aguardando verificação",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
} as const;
export const COR_STATUS_NC = { ABERTA: "vermelho", EM_TRATAMENTO: "amarelo", AGUARDANDO_VERIFICACAO: "azul", ENCERRADA: "verde", CANCELADA: "cinza" } as const;
export const ROTULO_ORIGEM_NC = {
  RQ: "Registro da qualidade (RQ)",
  RECLAMACAO_CLIENTE: "Reclamação de cliente",
  AUDITORIA_INTERNA: "Auditoria interna",
  FISCALIZACAO: "Fiscalização MAPA",
  OUTRA: "Outra",
} as const;
export const ROTULO_GRAVIDADE = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta" } as const;
