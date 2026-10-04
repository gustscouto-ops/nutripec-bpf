/**
 * Testes de integração contra o PostgreSQL (DATABASE_URL).
 * Cria uma fábrica isolada, percorre recebimento → produção → expedição → rastreabilidade
 * e verifica as travas regulatórias e a imutabilidade dos registros.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { sincronizarCatalogo } from "@/lib/rq/sincronizar";
import { aprovarFormula, salvarProduto } from "@/lib/servicos/formula";
import { decidirLote, registrarRecebimento } from "@/lib/servicos/recebimento";
import { lotesDisponiveis, registrarExpedicao, registrarOrdem } from "@/lib/servicos/producao";
import { rastrearParaFrente, rastrearParaTras } from "@/lib/servicos/rastreabilidade";

const uid = randomUUID().slice(0, 8);
let ctx: Ctx;
let fornecedorId: string;
const mp: Record<string, string> = {};

const checklistOk = (umidade = 12) => ({
  veiculo_limpo: { valor: "C" }, lona_integra: { valor: "C" }, sem_pragas: { valor: "C" }, sem_mofo: { valor: "C" },
  embalagem_integra: { valor: "NA" }, rotulagem: { valor: "C" }, carga_exclusiva: { valor: "C" }, laudo: { valor: "C" },
  nf_confere: { valor: "C" }, umidade: { valor: umidade }, temperatura: { valor: 25 },
});

beforeAll(async () => {
  await sincronizarCatalogo(prisma);
  const tenant = await prisma.tenant.create({ data: { razaoSocial: `Teste ${uid}`, cnpj: `teste-${uid}` } });
  const user = await prisma.user.create({ data: { nome: "Tester", email: `t-${uid}@teste`, senhaHash: "x" } });
  await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, perfil: "RT" } });
  ctx = { userId: user.id, nome: "Tester", tenantId: tenant.id, tenantNome: "Teste", perfil: "RT", ip: null };
  for (const [prefixo, nome] of [["MIL", "Milho"], ["SOJ", "Soja"]]) {
    mp[prefixo] = (await prisma.materiaPrima.create({ data: { tenantId: tenant.id, nomeComercial: nome, prefixoLote: prefixo, categoria: "MACROINGREDIENTE" } })).id;
  }
  fornecedorId = (
    await prisma.fornecedor.create({
      data: {
        tenantId: tenant.id, razaoSocial: "Forn", cnpj: "1", statusQualificacao: "APROVADO",
        materiasPrimas: { create: [{ materiaPrimaId: mp.MIL, homologado: true }, { materiaPrimaId: mp.SOJ, homologado: false }] },
      },
    })
  ).id;
});

afterAll(() => prisma.$disconnect());

describe("fluxo completo de rastreabilidade", () => {
  let loteMil: string;
  let loteMilNc: string;
  let produtoId: string;
  let ordemId: string;

  it("bloqueia recebimento de MP não homologada", async () => {
    await expect(
      registrarRecebimento(ctx, { fornecedorId, materiaPrimaId: mp.SOJ, numeroNf: "1", quantidadeKg: 100, respostas: checklistOk(), fotos: [] }),
    ).rejects.toThrow(/não homologada/);
  });

  it("recebe carga conforme → lote liberado com código automático", async () => {
    const { lote, execucao } = await registrarRecebimento(ctx, { fornecedorId, materiaPrimaId: mp.MIL, numeroNf: "10", quantidadeKg: 5000, respostas: checklistOk(), fotos: [] });
    expect(lote.status).toBe("LIBERADO");
    expect(lote.codigoLoteInterno).toMatch(/^MIL-\d{8}$/);
    expect(execucao.hashAssinatura).toHaveLength(64);
    expect(execucao.numero).toBe(1);
    loteMil = lote.id;
  });

  it("carga com NC vai para quarentena, recebe sufixo e número sequencial", async () => {
    const r = checklistOk(16);
    const { lote, execucao } = await registrarRecebimento(ctx, {
      fornecedorId, materiaPrimaId: mp.MIL, numeroNf: "11", quantidadeKg: 3000, fotos: [],
      respostas: { ...r, umidade: { valor: 16, descricaoNc: "Umidade alta", acaoCorretiva: "Segregado no silo 3" } },
    });
    expect(lote.status).toBe("QUARENTENA");
    expect(lote.codigoLoteInterno).toMatch(/-2$/);
    expect(execucao.numero).toBe(2);
    loteMilNc = lote.id;
  });

  it("produção é bloqueada sem aprovação do RT", async () => {
    await prisma.fornecedorMateriaPrima.update({ where: { fornecedorId_materiaPrimaId: { fornecedorId, materiaPrimaId: mp.SOJ } }, data: { homologado: true } });
    await registrarRecebimento(ctx, { fornecedorId, materiaPrimaId: mp.SOJ, numeroNf: "12", quantidadeKg: 2000, respostas: checklistOk(), fotos: [] });
    const p = await salvarProduto(ctx, null, {
      codigo: "R1", nome: "Ração 1", pesoSacariaKg: 25, tamanhoBateladaKg: 1000, niveisGarantia: [], base: "percentual",
      itens: [{ materiaPrimaId: mp.MIL, percentual: 70 }, { materiaPrimaId: mp.SOJ, percentual: 30 }],
    });
    produtoId = p.id;
    await expect(registrarOrdem(ctx, { produtoId, turno: "MANHA", numeroBateladas: 1, consumos: [{ loteMateriaPrimaId: loteMil, quantidadeKg: 700 }] })).rejects.toThrow(/aprovação do RT/);
    await aprovarFormula(ctx, produtoId);
  });

  it("não permite usar lote em quarentena", async () => {
    const soja = (await lotesDisponiveis(ctx.tenantId, [mp.SOJ]))[0];
    await expect(
      registrarOrdem(ctx, { produtoId, turno: "MANHA", numeroBateladas: 1, consumos: [{ loteMateriaPrimaId: loteMilNc, quantidadeKg: 700 }, { loteMateriaPrimaId: soja.id, quantidadeKg: 300 }] }),
    ).rejects.toThrow(/quarentena/);
  });

  it("exige justificativa para desvio de formulação", async () => {
    const soja = (await lotesDisponiveis(ctx.tenantId, [mp.SOJ]))[0];
    await expect(
      registrarOrdem(ctx, { produtoId, turno: "MANHA", numeroBateladas: 2, consumos: [{ loteMateriaPrimaId: loteMil, quantidadeKg: 1400 }, { loteMateriaPrimaId: soja.id, quantidadeKg: 500 }] }),
    ).rejects.toThrow(/Desvio/);
  });

  it("registra ordem, consome saldo e expede", async () => {
    const soja = (await lotesDisponiveis(ctx.tenantId, [mp.SOJ]))[0];
    const ordem = await registrarOrdem(ctx, { produtoId, turno: "MANHA", numeroBateladas: 2, consumos: [{ loteMateriaPrimaId: loteMil, quantidadeKg: 1400 }, { loteMateriaPrimaId: soja.id, quantidadeKg: 600 }] });
    expect(ordem.quantidadeSacasProduzidas).toBe(80);
    expect(ordem.sequenciaDia).toBeGreaterThanOrEqual(1);
    ordemId = ordem.id;
    const disp = await lotesDisponiveis(ctx.tenantId, [mp.MIL]);
    expect(disp.find((l) => l.id === loteMil)?.saldoKg).toBe(3600);
    await registrarExpedicao(ctx, { producaoOrdemId: ordemId, clienteNome: "Fazenda X", numeroNf: "900", quantidadeSacas: 50 });
    await expect(registrarExpedicao(ctx, { producaoOrdemId: ordemId, clienteNome: "Fazenda Y", numeroNf: "901", quantidadeSacas: 31 })).rejects.toThrow(/Saldo insuficiente/);
  });

  it("não permite consumir mais que o saldo do lote", async () => {
    const soja = (await lotesDisponiveis(ctx.tenantId, [mp.SOJ]))[0];
    await expect(
      registrarOrdem(ctx, { produtoId, turno: "TARDE", numeroBateladas: 10, consumos: [{ loteMateriaPrimaId: loteMil, quantidadeKg: 7000 }, { loteMateriaPrimaId: soja.id, quantidadeKg: 3000 }] }),
    ).rejects.toThrow(/Saldo insuficiente/);
  });

  it("rastreia para trás e para frente", async () => {
    const tras = await rastrearParaTras(ctx.tenantId, ordemId);
    expect(tras!.ordem.consumos.map((c) => c.lote.id)).toContain(loteMil);
    expect(tras!.saldoSacas).toBe(30);
    const frente = await rastrearParaFrente(ctx.tenantId, loteMil);
    expect(frente!.clientes.map((c) => c.cliente)).toEqual(["Fazenda X"]);
    expect(frente!.sacasEmEstoque).toBe(30);
    expect(frente!.saldoKg).toBe(3600);
  });

  it("RT decide lote em quarentena com justificativa", async () => {
    await expect(decidirLote(ctx, loteMilNc, "LIBERADO", "")).rejects.toThrow(/justificativa/);
    const l = await decidirLote(ctx, loteMilNc, "LIBERADO", "Secado para 13% (laudo 55)");
    expect(l.status).toBe("LIBERADO");
  });

  it("alterar fórmula aprovada gera nova versão em rascunho", async () => {
    const p = await salvarProduto(ctx, produtoId, {
      codigo: "R1", nome: "Ração 1", pesoSacariaKg: 25, tamanhoBateladaKg: 1000, niveisGarantia: [], base: "percentual",
      itens: [{ materiaPrimaId: mp.MIL, percentual: 75 }, { materiaPrimaId: mp.SOJ, percentual: 25 }],
    });
    expect(p.statusFormula).toBe("RASCUNHO");
    expect(p.versaoFormula).toBe(2);
  });

  it("registros assinados e trilha de auditoria são imutáveis no banco", async () => {
    await expect(prisma.auditLog.deleteMany({ where: { tenantId: ctx.tenantId } })).rejects.toThrow(/imutável/);
    const rq = await prisma.rqExecucao.findFirstOrThrow({ where: { tenantId: ctx.tenantId } });
    await expect(prisma.rqExecucao.update({ where: { id: rq.id }, data: { status: "CONFORME", respostas: {} } })).rejects.toThrow(/não pode ser alterado/);
    const logs = await prisma.auditLog.count({ where: { tenantId: ctx.tenantId } });
    expect(logs).toBeGreaterThan(8);
  });
});
