import { Prisma, type LoteMateriaPrima, type RqExecucao } from "@prisma/client";
import { prisma, num } from "../db";
import { registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import { gerarCodigoUnico } from "../lote";
import { periodoDoDia } from "../agenda";
import { avaliarRespostas, type CampoRq, type Respostas } from "../rq/campos";
import type { Ctx } from "../auth";
import { CODIGO_RQ_RECEBIMENTO, MAX_FOTOS, abrirNcsDaExecucao, gravarFotos, modeloEfetivo, proximoNumero, travarRq, validarFotos } from "./rq";

export { CODIGO_RQ_RECEBIMENTO, MAX_FOTOS };

export type RecebimentoInput = {
  fornecedorId: string;
  materiaPrimaId: string;
  numeroNf: string;
  quantidadeKg: number;
  loteFornecedor?: string | null;
  dataFabricacao?: string | null;
  dataValidade?: string | null;
  placaVeiculo?: string | null;
  transportadora?: string | null;
  motorista?: string | null;
  observacoes?: string | null;
  respostas: Respostas;
  fotos: { conteudo: Buffer; mimeType: string; descricao?: string }[];
};

export type CabecalhoRecebimento = {
  fornecedor: { id: string; razaoSocial: string; cnpj: string; registroMapa: string | null };
  materiaPrima: { id: string; nome: string; categoria: string; unidade: string };
  numeroNf: string;
  quantidadeKg: number;
  loteFornecedor: string | null;
  dataFabricacao: string | null;
  dataValidade: string | null;
  placaVeiculo: string | null;
  transportadora: string | null;
  motorista: string | null;
  codigoLoteInterno: string;
  limites: { umidadeMaxPct: number | null; temperaturaMaxC: number | null };
};

function data(v?: string | null) {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new ErroNegocio("Data inválida.");
  return d;
}

/** Pares fornecedor × matéria-prima liberados para recebimento (fornecedor aprovado e MP homologada). */
export async function paresHomologados(tenantId: string) {
  return prisma.fornecedorMateriaPrima.findMany({
    where: {
      homologado: true,
      fornecedor: { tenantId, ativo: true, statusQualificacao: "APROVADO" },
      materiaPrima: { tenantId, ativo: true },
    },
    include: { fornecedor: true, materiaPrima: true },
    orderBy: [{ fornecedor: { razaoSocial: "asc" } }, { materiaPrima: { nomeComercial: "asc" } }],
  });
}

/**
 * RQ 1.2 — Recebimento e Inspeção de Carga.
 * Valida o checklist, gera o lote interno, grava fotos, assina (hash SHA-256) e cria o lote de MP.
 * Carga conforme → lote LIBERADO. Qualquer não conformidade → lote em QUARENTENA até decisão do RT.
 */
export async function registrarRecebimento(ctx: Ctx, input: RecebimentoInput) {
  const numeroNf = input.numeroNf?.trim();
  if (!numeroNf) throw new ErroNegocio("Informe o número da nota fiscal.", { numeroNf: "Obrigatório" });
  if (!(input.quantidadeKg > 0)) throw new ErroNegocio("Informe o peso total da carga.", { quantidadeKg: "Obrigatório" });
  validarFotos(input.fotos);

  const [tenant, modelo, vinculo] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
    modeloEfetivo(ctx.tenantId, CODIGO_RQ_RECEBIMENTO),
    prisma.fornecedorMateriaPrima.findUnique({
      where: { fornecedorId_materiaPrimaId: { fornecedorId: input.fornecedorId, materiaPrimaId: input.materiaPrimaId } },
      include: { fornecedor: true, materiaPrima: true },
    }),
  ]);
  if (!modelo || !modelo.ativo) throw new ErroNegocio("RQ 1.2 indisponível.");
  if (!vinculo || vinculo.fornecedor.tenantId !== ctx.tenantId || vinculo.materiaPrima.tenantId !== ctx.tenantId) {
    throw new ErroNegocio("Esta matéria-prima não está vinculada a este fornecedor.");
  }
  if (vinculo.fornecedor.statusQualificacao !== "APROVADO") {
    throw new ErroNegocio("Fornecedor não homologado (POP 01). Recebimento bloqueado.");
  }
  if (!vinculo.homologado) throw new ErroNegocio("Matéria-prima não homologada para este fornecedor (POP 01).");

  const mp = vinculo.materiaPrima;
  const limites = {
    umidadeMaxPct: mp.umidadeMaxPct === null ? null : num(mp.umidadeMaxPct),
    temperaturaMaxC: mp.temperaturaMaxC === null ? null : num(mp.temperaturaMaxC),
  };
  const campos = modelo.campos as unknown as CampoRq[];
  const avaliacao = avaliarRespostas(campos, input.respostas ?? {}, limites);
  if (Object.keys(avaliacao.erros).length) {
    throw new ErroNegocio("Checklist incompleto. Revise os itens destacados.", avaliacao.erros);
  }

  // Fotos são gravadas antes da transação; o hash de cada uma entra no conteúdo assinado.
  const fotos = await gravarFotos(ctx.tenantId, input.fotos);

  for (let tentativa = 0; ; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agora = new Date();
        const periodo = periodoDoDia(agora);
        await travarRq(tx, ctx.tenantId, modelo.codigoRq);
        const numero = await proximoNumero(tx, ctx.tenantId, modelo.codigoRq);
        const codigoLoteInterno = await gerarCodigoUnico(
          tenant.regraLoteMp,
          { PREFIXO: mp.prefixoLote, data: agora },
          async (c) => !!(await tx.loteMateriaPrima.findUnique({ where: { tenantId_codigoLoteInterno: { tenantId: ctx.tenantId, codigoLoteInterno: c } } })),
        );

        const cabecalho: CabecalhoRecebimento = {
          fornecedor: {
            id: vinculo.fornecedor.id,
            razaoSocial: vinculo.fornecedor.razaoSocial,
            cnpj: vinculo.fornecedor.cnpj,
            registroMapa: vinculo.fornecedor.registroMapa,
          },
          materiaPrima: { id: mp.id, nome: mp.nomeComercial, categoria: mp.categoria, unidade: mp.unidadeMedida },
          numeroNf,
          quantidadeKg: input.quantidadeKg,
          loteFornecedor: input.loteFornecedor?.trim() || null,
          dataFabricacao: input.dataFabricacao || null,
          dataValidade: input.dataValidade || null,
          placaVeiculo: input.placaVeiculo?.trim().toUpperCase() || null,
          transportadora: input.transportadora?.trim() || null,
          motorista: input.motorista?.trim() || null,
          codigoLoteInterno,
          limites,
        };

        const hash = hashAssinatura({
          tenantId: ctx.tenantId,
          rq: modelo.codigoRq,
          versaoModelo: modelo.versao,
          campos,
          numero,
          dataHora: agora.toISOString(),
          assinante: { id: ctx.userId, nome: ctx.nome, perfil: ctx.perfil },
          status: avaliacao.status,
          cabecalho,
          respostas: avaliacao.respostas,
          observacoes: input.observacoes?.trim() || null,
          fotos: fotos.map((f) => f.hashArquivo),
        });

        const execucao: RqExecucao = await tx.rqExecucao.create({
          data: {
            tenantId: ctx.tenantId,
            rqModeloId: modelo.id,
            codigoRq: modelo.codigoRq,
            versaoModelo: modelo.versao,
            campos: campos as unknown as Prisma.InputJsonValue,
            numero,
            referenciaInicio: periodo.inicio,
            referenciaFim: periodo.fim,
            userIdAssinatura: ctx.userId,
            nomeAssinatura: ctx.nome,
            perfilAssinatura: ctx.perfil,
            dataHoraExecucao: agora,
            status: avaliacao.status,
            respostas: avaliacao.respostas as Prisma.InputJsonValue,
            cabecalho: cabecalho as unknown as Prisma.InputJsonValue,
            observacoes: input.observacoes?.trim() || null,
            hashAssinatura: hash,
            ipOrigem: ctx.ip,
            pdfUrl: null,
            fotos: { create: fotos },
          },
        });

        const conforme = avaliacao.status === "CONFORME";
        const lote: LoteMateriaPrima = await tx.loteMateriaPrima.create({
          data: {
            tenantId: ctx.tenantId,
            materiaPrimaId: mp.id,
            fornecedorId: vinculo.fornecedor.id,
            codigoLoteInterno,
            loteFornecedor: cabecalho.loteFornecedor,
            numeroNf,
            quantidadeKg: input.quantidadeKg,
            dataRecebimento: agora,
            dataFabricacao: data(input.dataFabricacao),
            dataValidade: data(input.dataValidade),
            status: conforme ? "LIBERADO" : "QUARENTENA",
            aprovado: conforme,
            rqExecucaoId: execucao.id,
          },
        });
        await tx.rqExecucao.update({ where: { id: execucao.id }, data: { pdfUrl: `/api/rq/${execucao.id}/pdf` } });

        await registrarAuditoria(tx, ctx, { tabela: "rqExecucao", registroId: execucao.id, acao: "ASSINATURA", depois: { ...execucao, fotos } });
        await registrarAuditoria(tx, ctx, { tabela: "loteMateriaPrima", registroId: lote.id, acao: "CREATE", depois: lote });
        const ncs = await abrirNcsDaExecucao(tx, ctx, execucao, modelo, avaliacao, {
          fornecedorId: vinculo.fornecedor.id,
          loteReferencia: codigoLoteInterno,
          prefixoTitulo: `${mp.nomeComercial} (${codigoLoteInterno})`,
        });
        return { execucao, lote, ncs };
      });
    } catch (e) {
      const conflito = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (conflito && tentativa < 3) continue; // dois recebimentos simultâneos: tenta o próximo número
      throw e;
    }
  }
}

/** Decisão do RT sobre lote em quarentena (liberar com ressalva ou reprovar/devolver). */
export async function decidirLote(ctx: Ctx, loteId: string, decisao: "LIBERADO" | "REPROVADO", motivo: string) {
  if ((motivo ?? "").trim().length < 5) throw new ErroNegocio("Descreva a justificativa da decisão.");
  return prisma.$transaction(async (tx) => {
    const lote = await tx.loteMateriaPrima.findFirst({ where: { id: loteId, tenantId: ctx.tenantId }, include: { consumos: true } });
    if (!lote) throw new ErroNegocio("Lote não encontrado.");
    if (lote.status !== "QUARENTENA") throw new ErroNegocio("Somente lotes em quarentena aguardam decisão.");
    const depois = await tx.loteMateriaPrima.update({
      where: { id: lote.id },
      data: {
        status: decisao,
        aprovado: decisao === "LIBERADO",
        decisaoRtUserId: ctx.userId,
        decisaoRtNome: ctx.nome,
        decisaoRtEm: new Date(),
        decisaoRtMotivo: motivo.trim(),
      },
    });
    const { consumos: _c, ...antes } = lote;
    await registrarAuditoria(tx, ctx, { tabela: "loteMateriaPrima", registroId: lote.id, acao: `DECISAO_RT_${decisao}`, antes, depois });
    return depois;
  });
}

/** Saldo em estoque (kg) de cada lote = recebido − consumido em produção. */
export async function saldosLotes(tenantId: string, loteIds?: string[]) {
  const consumos = await prisma.producaoConsumoLote.groupBy({
    by: ["loteMateriaPrimaId"],
    where: { lote: { tenantId }, ...(loteIds ? { loteMateriaPrimaId: { in: loteIds } } : {}) },
    _sum: { quantidadeUtilizadaKg: true },
  });
  return new Map(consumos.map((c) => [c.loteMateriaPrimaId, num(c._sum.quantidadeUtilizadaKg)]));
}
