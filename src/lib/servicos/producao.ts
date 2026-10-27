import { Prisma, type Turno } from "@prisma/client";
import { prisma, num } from "../db";
import { registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura } from "../hash";
import { gerarCodigoUnico, partesData } from "../lote";
import type { Ctx } from "../auth";

export type OrdemInput = {
  produtoId: string;
  turno: Turno;
  misturador?: string | null;
  numeroBateladas: number;
  quantidadeSacas?: number | null;
  dataValidade?: string | null;
  observacoes?: string | null;
  consumos: { loteMateriaPrimaId: string; quantidadeKg: number }[];
};

/** Desvio permitido entre o dosado e o previsto pela fórmula, por ingrediente. */
export const TOLERANCIA_DESVIO_PCT = 2;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function inicioDoDia(data: Date) {
  const { DD, MM, AAAA } = partesData(data);
  return new Date(`${AAAA}-${MM}-${DD}T00:00:00-03:00`);
}

/**
 * Registra uma ordem/batida de produção (POP 05 — prevenção de contaminação cruzada e sequenciamento) e o consumo de lotes de MP,
 * que é a ligação da rastreabilidade entrada → transformação.
 */
export async function registrarOrdem(ctx: Ctx, input: OrdemInput) {
  if (!(input.numeroBateladas > 0) || !Number.isInteger(input.numeroBateladas)) {
    throw new ErroNegocio("Número de bateladas inválido.");
  }
  const consumos = input.consumos.filter((c) => c.loteMateriaPrimaId && c.quantidadeKg > 0);
  if (!consumos.length) throw new ErroNegocio("Informe os lotes de matéria-prima utilizados.");

  for (let tentativa = 0; ; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [tenant, produto] = await Promise.all([
          tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
          tx.produto.findFirst({ where: { id: input.produtoId, tenantId: ctx.tenantId }, include: { itens: { include: { materiaPrima: true } } } }),
        ]);
        if (!produto) throw new ErroNegocio("Produto não encontrado.");
        if (produto.statusFormula !== "APROVADA") {
          throw new ErroNegocio("Fórmula sem aprovação do RT. Produção bloqueada.");
        }

        // Trava os lotes para que dois registros simultâneos não consumam o mesmo saldo.
        const ids = [...new Set(consumos.map((c) => c.loteMateriaPrimaId))];
        await tx.$queryRaw`SELECT id FROM lotes_materia_prima WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
        const lotes = await tx.loteMateriaPrima.findMany({ where: { id: { in: ids }, tenantId: ctx.tenantId }, include: { materiaPrima: true } });
        if (lotes.length !== ids.length) throw new ErroNegocio("Lote de matéria-prima inválido.");
        const usados = await tx.producaoConsumoLote.groupBy({
          by: ["loteMateriaPrimaId"],
          where: { loteMateriaPrimaId: { in: ids } },
          _sum: { quantidadeUtilizadaKg: true },
        });
        const usadoPorLote = new Map(usados.map((u) => [u.loteMateriaPrimaId, num(u._sum.quantidadeUtilizadaKg)]));

        const itensPorMp = new Map(produto.itens.map((i) => [i.materiaPrimaId, i]));
        const dosadoPorMp = new Map<string, number>();
        const pedidoPorLote = new Map<string, number>();
        for (const c of consumos) pedidoPorLote.set(c.loteMateriaPrimaId, (pedidoPorLote.get(c.loteMateriaPrimaId) ?? 0) + c.quantidadeKg);

        for (const lote of lotes) {
          if (lote.status !== "LIBERADO") {
            throw new ErroNegocio(`Lote ${lote.codigoLoteInterno} está ${lote.status.toLowerCase()} e não pode ser usado.`);
          }
          if (!itensPorMp.has(lote.materiaPrimaId)) {
            throw new ErroNegocio(`${lote.materiaPrima.nomeComercial} não faz parte da fórmula de ${produto.nome}.`);
          }
          if (lote.dataValidade && lote.dataValidade < inicioDoDia(new Date())) {
            throw new ErroNegocio(`Lote ${lote.codigoLoteInterno} está vencido.`);
          }
          const saldo = num(lote.quantidadeKg) - (usadoPorLote.get(lote.id) ?? 0);
          const pedido = pedidoPorLote.get(lote.id)!;
          if (pedido > saldo + 0.0005) {
            throw new ErroNegocio(`Saldo insuficiente no lote ${lote.codigoLoteInterno} (saldo ${saldo.toFixed(3)} kg).`);
          }
          dosadoPorMp.set(lote.materiaPrimaId, (dosadoPorMp.get(lote.materiaPrimaId) ?? 0) + pedido);
        }

        const desvios = produto.itens.map((i) => {
          const previsto = r3(num(i.quantidadeBateladaKg) * input.numeroBateladas);
          const dosado = r3(dosadoPorMp.get(i.materiaPrimaId) ?? 0);
          const desvioPct = previsto ? ((dosado - previsto) / previsto) * 100 : 0;
          return { materiaPrimaId: i.materiaPrimaId, nome: i.materiaPrima.nomeComercial, previsto, dosado, desvioPct: Math.round(desvioPct * 100) / 100 };
        });
        const faltantes = desvios.filter((d) => d.dosado === 0);
        if (faltantes.length) {
          throw new ErroNegocio(`Informe o lote utilizado de: ${faltantes.map((f) => f.nome).join(", ")}.`);
        }
        const foraTolerancia = desvios.filter((d) => Math.abs(d.desvioPct) > TOLERANCIA_DESVIO_PCT);
        if (foraTolerancia.length && (input.observacoes ?? "").trim().length < 5) {
          throw new ErroNegocio(
            `Desvio de formulação acima de ${TOLERANCIA_DESVIO_PCT}% em ${foraTolerancia.map((f) => f.nome).join(", ")}. Justifique nas observações.`,
          );
        }

        const agora = new Date();
        const sequenciaDia = (await tx.producaoOrdem.count({ where: { tenantId: ctx.tenantId, dataHoraInicio: { gte: inicioDoDia(agora) } } })) + 1;
        const codigoLoteProduzido = await gerarCodigoUnico(
          tenant.regraLoteProd,
          { CODIGO: produto.codigo, data: agora },
          async (c) => !!(await tx.producaoOrdem.findUnique({ where: { tenantId_codigoLoteProduzido: { tenantId: ctx.tenantId, codigoLoteProduzido: c } } })),
        );
        const totalKg = num(produto.tamanhoBateladaKg) * input.numeroBateladas;
        const sacas = input.quantidadeSacas && input.quantidadeSacas > 0 ? Math.floor(input.quantidadeSacas) : Math.floor(totalKg / num(produto.pesoSacariaKg));

        const conteudo = {
          tenantId: ctx.tenantId,
          produto: { id: produto.id, codigo: produto.codigo, versaoFormula: produto.versaoFormula, hashFormula: produto.hashFormula },
          codigoLoteProduzido,
          sequenciaDia,
          dataHora: agora.toISOString(),
          turno: input.turno,
          misturador: input.misturador || null,
          numeroBateladas: input.numeroBateladas,
          sacas,
          consumos: consumos.map((c) => ({ lote: c.loteMateriaPrimaId, kg: c.quantidadeKg })),
          operador: { id: ctx.userId, nome: ctx.nome },
        };

        const ordem = await tx.producaoOrdem.create({
          data: {
            tenantId: ctx.tenantId,
            produtoId: produto.id,
            codigoLoteProduzido,
            sequenciaDia,
            misturador: input.misturador || null,
            dataHoraInicio: agora,
            turno: input.turno,
            numeroBateladas: input.numeroBateladas,
            quantidadeSacasProduzidas: sacas,
            dataValidade: input.dataValidade ? new Date(`${input.dataValidade}T12:00:00Z`) : null,
            versaoFormula: produto.versaoFormula,
            operadorUserId: ctx.userId,
            operadorNome: ctx.nome,
            hashAssinatura: hashAssinatura(conteudo),
            observacoes: input.observacoes?.trim() || null,
            consumos: { create: consumos.map((c) => ({ loteMateriaPrimaId: c.loteMateriaPrimaId, quantidadeUtilizadaKg: c.quantidadeKg })) },
          },
          include: { consumos: true },
        });
        await registrarAuditoria(tx, ctx, { tabela: "producaoOrdem", registroId: ordem.id, acao: "ASSINATURA", depois: { ...ordem, desvios } });
        return ordem;
      });
    } catch (e) {
      const conflito = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (conflito && tentativa < 3) continue;
      throw e;
    }
  }
}

/** Lotes liberados com saldo, por matéria-prima, ordenados por FEFO/FIFO (validade, depois recebimento). */
export async function lotesDisponiveis(tenantId: string, materiaPrimaIds: string[]) {
  const lotes = await prisma.loteMateriaPrima.findMany({
    where: { tenantId, status: "LIBERADO", materiaPrimaId: { in: materiaPrimaIds } },
    include: { consumos: { select: { quantidadeUtilizadaKg: true } }, fornecedor: { select: { razaoSocial: true } } },
    orderBy: [{ dataValidade: { sort: "asc", nulls: "last" } }, { dataRecebimento: "asc" }],
  });
  return lotes
    .map((l) => ({
      id: l.id,
      materiaPrimaId: l.materiaPrimaId,
      codigo: l.codigoLoteInterno,
      fornecedor: l.fornecedor.razaoSocial,
      dataValidade: l.dataValidade?.toISOString() ?? null,
      saldoKg: r3(num(l.quantidadeKg) - l.consumos.reduce((s, c) => s + num(c.quantidadeUtilizadaKg), 0)),
    }))
    .filter((l) => l.saldoKg > 0);
}

export type ExpedicaoInput = {
  producaoOrdemId: string;
  clienteNome: string;
  clienteDocumento?: string | null;
  clienteCidadeUf?: string | null;
  numeroNf: string;
  placaVeiculo?: string | null;
  quantidadeSacas: number;
};

/** Saída do produto acabado: fecha a ponta "cliente" da rastreabilidade. */
export async function registrarExpedicao(ctx: Ctx, input: ExpedicaoInput) {
  if (!input.clienteNome?.trim()) throw new ErroNegocio("Informe o cliente.");
  if (!input.numeroNf?.trim()) throw new ErroNegocio("Informe a nota fiscal.");
  if (!(input.quantidadeSacas > 0) || !Number.isInteger(input.quantidadeSacas)) throw new ErroNegocio("Quantidade de sacas inválida.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM producao_ordens WHERE id = ${input.producaoOrdemId} FOR UPDATE`;
    const ordem = await tx.producaoOrdem.findFirst({
      where: { id: input.producaoOrdemId, tenantId: ctx.tenantId },
      include: { expedicoes: { select: { quantidadeSacas: true } } },
    });
    if (!ordem) throw new ErroNegocio("Lote de produto acabado não encontrado.");
    const saldo = ordem.quantidadeSacasProduzidas - ordem.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0);
    if (input.quantidadeSacas > saldo) throw new ErroNegocio(`Saldo insuficiente do lote ${ordem.codigoLoteProduzido}: ${saldo} sacas.`);
    const envio = await tx.expedicaoEnvio.create({
      data: {
        tenantId: ctx.tenantId,
        producaoOrdemId: ordem.id,
        clienteNome: input.clienteNome.trim(),
        clienteDocumento: input.clienteDocumento?.trim() || null,
        clienteCidadeUf: input.clienteCidadeUf?.trim() || null,
        numeroNf: input.numeroNf.trim(),
        placaVeiculo: input.placaVeiculo?.trim().toUpperCase() || null,
        quantidadeSacas: input.quantidadeSacas,
        userId: ctx.userId,
        userNome: ctx.nome,
      },
    });
    await registrarAuditoria(tx, ctx, { tabela: "expedicaoEnvio", registroId: envio.id, acao: "CREATE", depois: envio });
    return envio;
  });
}
