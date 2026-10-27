import { prisma, num } from "../db";

/**
 * Rastreabilidade bidirecional (POP 09).
 *  - Para trás: lote de produto acabado → bateladas → lotes de MP → NF / fornecedor / RQ de recebimento.
 *  - Para frente (recall): lote de MP → ordens em que foi dosado → produtos → clientes → saldo em estoque.
 */

export async function buscarLotes(tenantId: string, termo: string) {
  const t = termo.trim();
  if (!t) return { produtos: [], materiasPrimas: [] };
  const [produtos, materiasPrimas] = await Promise.all([
    prisma.producaoOrdem.findMany({
      where: { tenantId, codigoLoteProduzido: { contains: t, mode: "insensitive" } },
      include: { produto: { select: { nome: true, codigo: true } } },
      orderBy: { dataHoraInicio: "desc" },
      take: 20,
    }),
    prisma.loteMateriaPrima.findMany({
      where: {
        tenantId,
        OR: [
          { codigoLoteInterno: { contains: t, mode: "insensitive" } },
          { loteFornecedor: { contains: t, mode: "insensitive" } },
          { numeroNf: { contains: t, mode: "insensitive" } },
        ],
      },
      include: { materiaPrima: { select: { nomeComercial: true } }, fornecedor: { select: { razaoSocial: true } } },
      orderBy: { dataRecebimento: "desc" },
      take: 20,
    }),
  ]);
  return { produtos, materiasPrimas };
}

export async function rastrearParaTras(tenantId: string, ordemId: string) {
  const ordem = await prisma.producaoOrdem.findFirst({
    where: { id: ordemId, tenantId },
    include: {
      produto: true,
      consumos: {
        include: {
          lote: {
            include: {
              materiaPrima: true,
              fornecedor: true,
              rqExecucao: { select: { id: true, numero: true, status: true, dataHoraExecucao: true, nomeAssinatura: true } },
            },
          },
        },
      },
      expedicoes: { orderBy: { dataHora: "asc" } },
    },
  });
  if (!ordem) return null;
  const expedido = ordem.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0);
  return { ordem, expedido, saldoSacas: ordem.quantidadeSacasProduzidas - expedido };
}

export async function rastrearParaFrente(tenantId: string, loteId: string) {
  const lote = await prisma.loteMateriaPrima.findFirst({
    where: { id: loteId, tenantId },
    include: {
      materiaPrima: true,
      fornecedor: true,
      rqExecucao: { select: { id: true, numero: true, status: true, dataHoraExecucao: true, nomeAssinatura: true } },
      consumos: {
        include: {
          ordem: {
            include: {
              produto: { select: { id: true, codigo: true, nome: true, pesoSacariaKg: true } },
              expedicoes: { orderBy: { dataHora: "asc" } },
            },
          },
        },
        orderBy: { ordem: { dataHoraInicio: "asc" } },
      },
    },
  });
  if (!lote) return null;
  const consumidoKg = lote.consumos.reduce((s, c) => s + num(c.quantidadeUtilizadaKg), 0);
  const ordens = lote.consumos.map((c) => {
    const expedido = c.ordem.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0);
    return {
      consumoKg: num(c.quantidadeUtilizadaKg),
      ordem: c.ordem,
      expedido,
      saldoSacas: c.ordem.quantidadeSacasProduzidas - expedido,
    };
  });
  const clientes = new Map<string, { cliente: string; documento: string | null; cidadeUf: string | null; sacas: number; nfs: string[] }>();
  for (const o of ordens) {
    for (const e of o.ordem.expedicoes) {
      const chave = `${e.clienteNome}|${e.clienteDocumento ?? ""}`;
      const c = clientes.get(chave) ?? { cliente: e.clienteNome, documento: e.clienteDocumento, cidadeUf: e.clienteCidadeUf, sacas: 0, nfs: [] };
      c.sacas += e.quantidadeSacas;
      if (!c.nfs.includes(e.numeroNf)) c.nfs.push(e.numeroNf);
      clientes.set(chave, c);
    }
  }
  return {
    lote,
    consumidoKg,
    saldoKg: num(lote.quantidadeKg) - consumidoKg,
    ordens,
    clientes: [...clientes.values()],
    sacasEmEstoque: ordens.reduce((s, o) => s + o.saldoSacas, 0),
  };
}
