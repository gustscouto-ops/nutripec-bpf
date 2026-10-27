import { Prisma, type AlvoRecall, type RecallRegistro, type TipoRecall } from "@prisma/client";
import { prisma, num } from "../db";
import { registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import { avaliarRespostas, type CampoRq, type Respostas } from "../rq/campos";
import type { Ctx } from "../auth";
import { modeloEfetivo, registrarExecucaoRq, resolverReferencia } from "./rq";

/**
 * Recall em um clique (POP 09): cruza entrada → produção → saída a partir de um lote suspeito.
 *  - Lote de MP: todas as bateladas em que foi dosado, os lotes de produto gerados, os clientes e o estoque.
 *  - Lote de produto: os lotes de MP de origem e, a partir deles, todos os outros lotes de produto que
 *    usaram os mesmos insumos (recolhimento ampliado), com clientes e estoque.
 * O resultado aponta pendências que impediriam um recall real (lote sem RQ de recebimento, saldo negativo,
 * ordem sem consumo apontado ou com consumo abaixo do esperado).
 */

export type LoteMpRecall = {
  id: string;
  codigo: string;
  materiaPrima: string;
  fornecedor: string;
  cnpj: string;
  nf: string;
  loteFornecedor: string | null;
  recebidoEm: string;
  status: string;
  recebidoKg: number;
  consumidoKg: number;
  saldoKg: number;
  rq: { id: string; numero: number; status: string } | null;
};

export type OrdemRecall = {
  id: string;
  lote: string;
  produto: string;
  fabricadoEm: string;
  validade: string | null;
  sacas: number;
  expedidas: number;
  estoque: number;
  kgSuspeito: number;
  lotesMp: string[];
  alvo: boolean;
};

export type ClienteRecall = {
  nome: string;
  documento: string | null;
  cidadeUf: string | null;
  sacas: number;
  envios: { nf: string; data: string; lote: string; sacas: number; placa: string | null }[];
};

export type ResultadoRecall = {
  alvo: { tipo: AlvoRecall; id: string; codigo: string; descricao: string };
  lotesMp: LoteMpRecall[];
  ordens: OrdemRecall[];
  clientes: ClienteRecall[];
  totais: { lotesMp: number; ordens: number; sacasProduzidas: number; sacasExpedidas: number; sacasEstoque: number; clientes: number; kgSuspeitoConsumido: number };
  pendencias: string[];
};

const TOLERANCIA_CONSUMO = 0.95; // consumo apontado abaixo de 95% do esperado deixa o rastreio para trás incompleto
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function rastrearRecall(tenantId: string, alvoTipo: AlvoRecall, alvoId: string): Promise<ResultadoRecall> {
  let suspeitos: string[];
  let alvo: ResultadoRecall["alvo"];
  if (alvoTipo === "LOTE_MP") {
    const lote = await prisma.loteMateriaPrima.findFirst({ where: { id: alvoId, tenantId }, include: { materiaPrima: true, fornecedor: true } });
    if (!lote) throw new ErroNegocio("Lote de matéria-prima não encontrado.");
    suspeitos = [lote.id];
    alvo = { tipo: alvoTipo, id: lote.id, codigo: lote.codigoLoteInterno, descricao: `${lote.materiaPrima.nomeComercial} · ${lote.fornecedor.razaoSocial} · NF ${lote.numeroNf}` };
  } else {
    const ordem = await prisma.producaoOrdem.findFirst({ where: { id: alvoId, tenantId }, include: { produto: true, consumos: true } });
    if (!ordem) throw new ErroNegocio("Lote de produto não encontrado.");
    suspeitos = [...new Set(ordem.consumos.map((c) => c.loteMateriaPrimaId))];
    alvo = { tipo: alvoTipo, id: ordem.id, codigo: ordem.codigoLoteProduzido, descricao: `${ordem.produto.codigo} · ${ordem.produto.nome}` };
  }

  const [lotes, ordensDb] = await Promise.all([
    prisma.loteMateriaPrima.findMany({
      where: { tenantId, id: { in: suspeitos } },
      include: { materiaPrima: true, fornecedor: true, consumos: true, rqExecucao: { select: { id: true, numero: true, status: true } } },
      orderBy: { dataRecebimento: "asc" },
    }),
    prisma.producaoOrdem.findMany({
      where: { tenantId, OR: [{ consumos: { some: { loteMateriaPrimaId: { in: suspeitos } } } }, ...(alvoTipo === "LOTE_PRODUTO" ? [{ id: alvoId }] : [])] },
      include: { produto: true, consumos: { include: { lote: { select: { codigoLoteInterno: true } } } }, expedicoes: { orderBy: { dataHora: "asc" } } },
      orderBy: { dataHoraInicio: "asc" },
    }),
  ]);

  const pendencias: string[] = [];
  const lotesMp: LoteMpRecall[] = lotes.map((l) => {
    const consumidoKg = l.consumos.reduce((s, c) => s + num(c.quantidadeUtilizadaKg), 0);
    const saldoKg = num(l.quantidadeKg) - consumidoKg;
    if (!l.rqExecucao) pendencias.push(`Lote ${l.codigoLoteInterno} sem registro de recebimento (RQ 1.2) vinculado.`);
    if (saldoKg < -0.001) pendencias.push(`Lote ${l.codigoLoteInterno} com consumo maior que o recebido (${saldoKg.toFixed(1)} kg).`);
    return {
      id: l.id,
      codigo: l.codigoLoteInterno,
      materiaPrima: l.materiaPrima.nomeComercial,
      fornecedor: l.fornecedor.razaoSocial,
      cnpj: l.fornecedor.cnpj,
      nf: l.numeroNf,
      loteFornecedor: l.loteFornecedor,
      recebidoEm: l.dataRecebimento.toISOString(),
      status: l.status,
      recebidoKg: num(l.quantidadeKg),
      consumidoKg,
      saldoKg,
      rq: l.rqExecucao,
    };
  });
  if (alvoTipo === "LOTE_PRODUTO" && !lotesMp.length) pendencias.push(`Lote ${alvo.codigo} sem nenhum lote de matéria-prima apontado: não é possível rastrear a origem.`);

  const suspeitosSet = new Set(suspeitos);
  const clientes = new Map<string, ClienteRecall>();
  const ordens: OrdemRecall[] = ordensDb.map((o) => {
    const expedidas = o.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0);
    const consumoTotal = o.consumos.reduce((s, c) => s + num(c.quantidadeUtilizadaKg), 0);
    const esperado = o.numeroBateladas * num(o.produto.tamanhoBateladaKg);
    if (!o.consumos.length) pendencias.push(`Lote ${o.codigoLoteProduzido} sem consumo de matéria-prima apontado.`);
    else if (esperado > 0 && consumoTotal < esperado * TOLERANCIA_CONSUMO) {
      pendencias.push(`Lote ${o.codigoLoteProduzido}: apontados ${consumoTotal.toFixed(0)} kg de ${esperado.toFixed(0)} kg esperados; parte da origem não está rastreada.`);
    }
    if (expedidas > o.quantidadeSacasProduzidas) pendencias.push(`Lote ${o.codigoLoteProduzido} com mais sacas expedidas que produzidas.`);
    for (const e of o.expedicoes) {
      const chave = `${e.clienteNome.trim().toLowerCase()}|${e.clienteDocumento ?? ""}`;
      const c = clientes.get(chave) ?? { nome: e.clienteNome, documento: e.clienteDocumento, cidadeUf: e.clienteCidadeUf, sacas: 0, envios: [] };
      c.sacas += e.quantidadeSacas;
      c.envios.push({ nf: e.numeroNf, data: e.dataHora.toISOString(), lote: o.codigoLoteProduzido, sacas: e.quantidadeSacas, placa: e.placaVeiculo });
      clientes.set(chave, c);
    }
    return {
      id: o.id,
      lote: o.codigoLoteProduzido,
      produto: `${o.produto.codigo} · ${o.produto.nome}`,
      fabricadoEm: o.dataHoraInicio.toISOString(),
      validade: iso(o.dataValidade),
      sacas: o.quantidadeSacasProduzidas,
      expedidas,
      estoque: o.quantidadeSacasProduzidas - expedidas,
      kgSuspeito: o.consumos.filter((c) => suspeitosSet.has(c.loteMateriaPrimaId)).reduce((s, c) => s + num(c.quantidadeUtilizadaKg), 0),
      lotesMp: [...new Set(o.consumos.map((c) => c.lote.codigoLoteInterno))],
      alvo: alvoTipo === "LOTE_PRODUTO" && o.id === alvoId,
    };
  });

  const listaClientes = [...clientes.values()].sort((a, b) => b.sacas - a.sacas);
  return {
    alvo,
    lotesMp,
    ordens,
    clientes: listaClientes,
    totais: {
      lotesMp: lotesMp.length,
      ordens: ordens.length,
      sacasProduzidas: ordens.reduce((s, o) => s + o.sacas, 0),
      sacasExpedidas: ordens.reduce((s, o) => s + o.expedidas, 0),
      sacasEstoque: ordens.reduce((s, o) => s + o.estoque, 0),
      clientes: listaClientes.length,
      kgSuspeitoConsumido: ordens.reduce((s, o) => s + o.kgSuspeito, 0),
    },
    pendencias,
  };
}

export type RecallInput = { tipo: TipoRecall; alvoTipo: AlvoRecall; alvoId: string; motivo: string; iniciadoEm: Date };

const MAX_DURACAO_MIN = 24 * 60;

/**
 * Assina o simulado (ou recolhimento real) e congela o resultado. Um simulado também registra o RQ 9.1
 * do semestre, se ainda não houver, com o tempo medido e a conclusão do rastreio.
 */
export async function registrarRecall(ctx: Ctx, input: RecallInput, opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const motivo = input.motivo?.trim();
  if (!motivo || motivo.length < 5) throw new ErroNegocio("Descreva o motivo (ex.: simulado semestral, reclamação de cliente, aviso do fornecedor).");
  const inicio = new Date(input.iniciadoEm);
  if (Number.isNaN(inicio.getTime()) || inicio > agora) throw new ErroNegocio("Horário de início inválido.");
  const duracaoMin = Math.round((agora.getTime() - inicio.getTime()) / 60_000);
  if (duracaoMin > MAX_DURACAO_MIN) throw new ErroNegocio("O simulado foi iniciado há mais de 24 horas. Inicie um novo.");

  const resultado = await rastrearRecall(ctx.tenantId, input.alvoTipo, input.alvoId);
  const completo = resultado.pendencias.length === 0;
  const rq81 = input.tipo === "SIMULADO" ? await prepararRq81(ctx.tenantId, agora, duracaoMin, resultado) : null;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.tenantId}|RECALL`}))`;
    const ultimo = await tx.recallRegistro.aggregate({ where: { tenantId: ctx.tenantId }, _max: { numero: true } });
    const numero = (ultimo._max.numero ?? 0) + 1;

    let rqExecucaoId: string | null = null;
    if (rq81) {
      const { execucao } = await registrarExecucaoRq(
        ctx,
        { modeloId: rq81.modeloId, respostas: rq81.respostas, observacoes: `Gerado pelo simulado de recall nº ${String(numero).padStart(4, "0")} (${resultado.alvo.codigo}).`, fotos: [] },
        { agora, tx },
      );
      rqExecucaoId = execucao.id;
    }

    const conteudo = {
      tenantId: ctx.tenantId,
      numero,
      tipo: input.tipo,
      alvo: resultado.alvo,
      motivo,
      iniciadoEm: inicio.toISOString(),
      concluidoEm: agora.toISOString(),
      duracaoMin,
      resultado,
      assinante: { id: ctx.userId, nome: ctx.nome, perfil: ctx.perfil },
    };
    const registro = await tx.recallRegistro.create({
      data: {
        tenantId: ctx.tenantId,
        numero,
        tipo: input.tipo,
        alvoTipo: input.alvoTipo,
        alvoId: resultado.alvo.id,
        alvoCodigo: resultado.alvo.codigo,
        motivo,
        iniciadoEm: inicio,
        concluidoEm: agora,
        duracaoMin,
        resultado: resultado as unknown as Prisma.InputJsonValue,
        completo,
        pendencias: resultado.pendencias,
        userId: ctx.userId,
        userNome: ctx.nome,
        perfil: ctx.perfil,
        hash: hashAssinatura(conteudo),
        rqExecucaoId,
      },
    });
    await registrarAuditoria(tx, ctx, { tabela: "recall", registroId: registro.id, acao: "ASSINATURA", depois: { ...registro, resultado: undefined, totais: resultado.totais } });
    return { registro: registro as RecallRegistro, rqExecucaoId };
  });
}

/** Monta as respostas do RQ 9.1 vigente, ou null se o semestre já tem registro ou o formulário foi personalizado. */
async function prepararRq81(tenantId: string, agora: Date, duracaoMin: number, resultado: ResultadoRecall) {
  const modelo = await modeloEfetivo(tenantId, "RQ 9.1");
  if (!modelo?.ativo) return null;
  const { periodo } = resolverReferencia(modelo, null, agora);
  const feito = await prisma.rqExecucao.count({ where: { tenantId, codigoRq: "RQ 9.1", referenciaInicio: periodo.inicio } });
  if (feito) return null;

  const campos = modelo.campos as unknown as CampoRq[];
  const ids = new Set(campos.map((c) => c.id));
  if (!ids.has("tempo_min") || !ids.has("rastreio_completo")) return null;
  const pendencias = resultado.pendencias.join(" ").slice(0, 900);
  const respostas: Respostas = {
    tempo_min: { valor: duracaoMin },
    rastreio_completo: resultado.pendencias.length
      ? { valor: "NC", descricaoNc: pendencias, acaoCorretiva: "Pendências do rastreio registradas no simulado; corrigir apontamentos e cadastros antes do próximo simulado." }
      : { valor: "C" },
  };
  const avaliacao = avaliarRespostas(campos, respostas);
  if (avaliacao.erros.tempo_min) {
    respostas.tempo_min = { valor: duracaoMin, descricaoNc: `Rastreio levou ${duracaoMin} min, acima do limite do formulário.`, acaoCorretiva: "Treinar a equipe no uso da rastreabilidade e repetir o simulado." };
  }
  if (Object.keys(avaliarRespostas(campos, respostas).erros).length) return null; // há itens extras que só uma pessoa pode responder
  return { modeloId: modelo.id, respostas };
}

export const ROTULO_TIPO_RECALL = { SIMULADO: "Simulado", REAL: "Recolhimento real" } as const;
