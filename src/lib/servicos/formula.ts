import { Prisma, type Produto } from "@prisma/client";
import { prisma, num, type Tx } from "../db";
import { atualizarAuditado, criarAuditado, registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import type { Ctx } from "../auth";

export type NivelGarantia = { nutriente: string; valor: number; unidade: string; tipo?: "min" | "max" };

export type ProdutoInput = {
  codigo: string;
  nome: string;
  especieDestino?: string | null;
  categoria?: string | null;
  tipoEmbalagem?: string | null;
  pesoSacariaKg: number;
  tamanhoBateladaKg: number;
  modeloEtiqueta?: string | null;
  indicacaoUso?: string | null;
  modoUso?: string | null;
  composicaoBasica?: string | null;
  substitutivos?: string | null;
  restricoes?: string | null;
  registroProduto?: string | null;
  validadeDias?: number | null;
  conservacao?: string | null;
  niveisGarantia: NivelGarantia[];
  base: "percentual" | "batelada";
  itens: { materiaPrimaId: string; percentual?: number; quantidadeBateladaKg?: number }[];
};

const TOLERANCIA_SOMA = 0.01;
const r = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Converte os itens entre base percentual (%) e base batelada (kg do misturador). */
export function normalizarItens(input: Pick<ProdutoInput, "base" | "itens" | "tamanhoBateladaKg">) {
  const batelada = input.tamanhoBateladaKg;
  if (!(batelada > 0)) throw new ErroNegocio("Informe o tamanho da batelada (kg).");
  const vistos = new Set<string>();
  const itens = input.itens
    .filter((i) => i.materiaPrimaId)
    .map((i, ordem) => {
      if (vistos.has(i.materiaPrimaId)) throw new ErroNegocio("Matéria-prima repetida na fórmula.");
      vistos.add(i.materiaPrimaId);
      const percentual =
        input.base === "percentual" ? Number(i.percentual) : (Number(i.quantidadeBateladaKg) / batelada) * 100;
      const kg = input.base === "batelada" ? Number(i.quantidadeBateladaKg) : (Number(i.percentual) / 100) * batelada;
      if (!(percentual > 0) || !(kg > 0)) throw new ErroNegocio("Todas as inclusões devem ser maiores que zero.");
      return { materiaPrimaId: i.materiaPrimaId, percentual: r(percentual, 4), quantidadeBateladaKg: r(kg, 3), ordemDosagem: ordem + 1 };
    });
  const soma = itens.reduce((s, i) => s + i.percentual, 0);
  return { itens, soma: r(soma, 4) };
}

export function validarSomaFormula(soma: number) {
  if (Math.abs(soma - 100) > TOLERANCIA_SOMA) {
    throw new ErroNegocio(`A soma da fórmula deve ser 100% (atual: ${soma.toFixed(4)}%).`);
  }
}

/** Conteúdo assinado pelo RT: fórmula, níveis de garantia e informações de rotulagem. */
export function conteudoFormula(p: Produto & { itens: { materiaPrimaId: string; percentual: Prisma.Decimal; quantidadeBateladaKg: Prisma.Decimal }[] }) {
  return {
    produtoId: p.id,
    codigo: p.codigo,
    nome: p.nome,
    versao: p.versaoFormula,
    tamanhoBateladaKg: num(p.tamanhoBateladaKg),
    pesoSacariaKg: num(p.pesoSacariaKg),
    itens: p.itens
      .map((i) => ({ mp: i.materiaPrimaId, pct: num(i.percentual), kg: num(i.quantidadeBateladaKg) }))
      .sort((a, b) => a.mp.localeCompare(b.mp)),
    niveisGarantia: p.niveisGarantia,
    rotulagem: {
      indicacaoUso: p.indicacaoUso,
      modoUso: p.modoUso,
      composicaoBasica: p.composicaoBasica,
      substitutivos: p.substitutivos,
      restricoes: p.restricoes,
      registroProduto: p.registroProduto,
      validadeDias: p.validadeDias,
      conservacao: p.conservacao,
    },
  };
}

async function validarMateriasPrimas(tx: Tx, tenantId: string, ids: string[]) {
  const n = await tx.materiaPrima.count({ where: { tenantId, id: { in: ids } } });
  if (n !== ids.length) throw new ErroNegocio("Matéria-prima inválida para esta empresa.");
}

/**
 * Cria ou altera produto + fórmula. Qualquer alteração em produto aprovado gera nova versão
 * e volta para RASCUNHO, exigindo nova aprovação do RT.
 */
export async function salvarProduto(ctx: Ctx, id: string | null, input: ProdutoInput) {
  if (!input.codigo?.trim() || !input.nome?.trim()) throw new ErroNegocio("Código e nome são obrigatórios.");
  if (!(input.pesoSacariaKg > 0)) throw new ErroNegocio("Peso da sacaria deve ser maior que zero.");
  const { itens } = normalizarItens(input);
  if (input.validadeDias !== null && input.validadeDias !== undefined && !(Number(input.validadeDias) > 0)) throw new ErroNegocio("Validade deve ser um número de dias maior que zero.");

  const dados = {
    codigo: input.codigo.trim().toUpperCase(),
    nome: input.nome.trim(),
    especieDestino: input.especieDestino || null,
    categoria: input.categoria || null,
    tipoEmbalagem: input.tipoEmbalagem || null,
    pesoSacariaKg: input.pesoSacariaKg,
    tamanhoBateladaKg: input.tamanhoBateladaKg,
    modeloEtiqueta: input.modeloEtiqueta || null,
    indicacaoUso: input.indicacaoUso || null,
    modoUso: input.modoUso || null,
    composicaoBasica: input.composicaoBasica || null,
    substitutivos: input.substitutivos || null,
    restricoes: input.restricoes || null,
    registroProduto: input.registroProduto?.trim() || null,
    validadeDias: input.validadeDias ? Math.round(Number(input.validadeDias)) : null,
    conservacao: input.conservacao?.trim() || null,
    niveisGarantia: (input.niveisGarantia ?? []).filter((n) => n.nutriente?.trim()) as unknown as Prisma.InputJsonValue,
  };

  return prisma.$transaction(async (tx) => {
    await validarMateriasPrimas(tx, ctx.tenantId, itens.map((i) => i.materiaPrimaId));
    let produto: Produto;
    if (!id) {
      produto = await criarAuditado<Produto>(tx, ctx, "produto", { ...dados, tenantId: ctx.tenantId });
    } else {
      const atual = await tx.produto.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { itens: true } });
      if (!atual) throw new ErroNegocio("Produto não encontrado.");
      const novaVersao = atual.statusFormula !== "RASCUNHO";
      produto = await atualizarAuditado<Produto>(tx, ctx, "produto", id, {
        ...dados,
        statusFormula: "RASCUNHO",
        versaoFormula: novaVersao ? atual.versaoFormula + 1 : atual.versaoFormula,
        aprovadoRtUserId: null,
        aprovadoRtNome: null,
        dataAprovacaoRt: null,
        hashFormula: null,
      });
      await registrarAuditoria(tx, ctx, { tabela: "formulasItens", registroId: id, acao: "DELETE", antes: atual.itens });
      await tx.formulaItem.deleteMany({ where: { produtoId: id } });
    }
    await tx.formulaItem.createMany({ data: itens.map((i) => ({ ...i, produtoId: produto.id })) });
    await registrarAuditoria(tx, ctx, { tabela: "formulasItens", registroId: produto.id, acao: "CREATE", depois: itens });
    return produto;
  });
}

/** Aprovação e assinatura do RT. Só aprova fórmula fechando 100%. */
export async function aprovarFormula(ctx: Ctx, produtoId: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.produto.findFirst({ where: { id: produtoId, tenantId: ctx.tenantId }, include: { itens: true } });
    if (!p) throw new ErroNegocio("Produto não encontrado.");
    if (p.statusFormula === "APROVADA") throw new ErroNegocio("Esta versão da fórmula já está aprovada.");
    if (!p.itens.length) throw new ErroNegocio("A fórmula não tem ingredientes.");
    validarSomaFormula(p.itens.reduce((s, i) => s + num(i.percentual), 0));
    const agora = new Date();
    const hash = hashAssinatura({ ...conteudoFormula(p), aprovadoPor: ctx.userId, aprovadoEm: agora.toISOString() });
    return atualizarAuditado<Produto>(
      tx,
      ctx,
      "produto",
      p.id,
      {
        statusFormula: "APROVADA",
        aprovadoRtUserId: ctx.userId,
        aprovadoRtNome: ctx.nome,
        dataAprovacaoRt: agora,
        hashFormula: hash,
      },
      "APROVACAO_RT",
    );
  });
}
