/**
 * Fase 3: recall em um clique, rótulo/ZPL e dossiê de fiscalização.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { sha256 } from "@/lib/hash";
import { sincronizarCatalogo } from "@/lib/rq/sincronizar";
import { registrarRecebimento } from "@/lib/servicos/recebimento";
import { rastrearRecall, registrarRecall } from "@/lib/servicos/recall";
import { intervalo, resumoDossie } from "@/lib/servicos/dossie";
import { gerarPacoteDossie } from "@/lib/servicos/pacote-dossie";
import { gerarZpl, pendenciasRotulo, textoZpl, type DadosRotulo } from "@/lib/rotulo";
import { chaveDia } from "@/lib/agenda";

const uid = randomUUID().slice(0, 8);
let ctx: Ctx;
const ids: Record<string, string> = {};

const checklistOk = {
  veiculo_limpo: { valor: "C" }, lona_integra: { valor: "C" }, sem_pragas: { valor: "C" }, sem_mofo: { valor: "C" },
  embalagem_integra: { valor: "NA" }, rotulagem: { valor: "C" }, carga_exclusiva: { valor: "C" }, laudo: { valor: "C" },
  nf_confere: { valor: "C" }, umidade: { valor: 12 }, temperatura: { valor: 25 },
};

async function ordem(codigo: string, consumos: [string, number][], sacas: number, envios: [string, number][]) {
  const o = await prisma.producaoOrdem.create({
    data: {
      tenantId: ctx.tenantId, produtoId: ids.produto, codigoLoteProduzido: codigo, sequenciaDia: 1, turno: "MANHA", numeroBateladas: 1,
      quantidadeSacasProduzidas: sacas, versaoFormula: 1, operadorUserId: ctx.userId, operadorNome: ctx.nome, hashAssinatura: "x",
      consumos: { create: consumos.map(([lote, kg]) => ({ loteMateriaPrimaId: lote, quantidadeUtilizadaKg: kg })) },
    },
  });
  for (const [cliente, n] of envios) {
    await prisma.expedicaoEnvio.create({ data: { tenantId: ctx.tenantId, clienteNome: cliente, numeroNf: `NF-${codigo}-${cliente}`, producaoOrdemId: o.id, quantidadeSacas: n, userId: ctx.userId, userNome: ctx.nome } });
  }
  return o.id;
}

beforeAll(async () => {
  await sincronizarCatalogo(prisma);
  const tenant = await prisma.tenant.create({ data: { razaoSocial: `Recall ${uid}`, cnpj: `rc-${uid}`, createdAt: new Date(Date.now() - 40 * 86_400_000) } });
  const user = await prisma.user.create({ data: { nome: "RT Recall", email: `rc-${uid}@teste`, senhaHash: "x" } });
  await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, perfil: "RT" } });
  ctx = { userId: user.id, nome: "RT Recall", tenantId: tenant.id, tenantNome: "Recall", perfil: "RT", ip: null };
  const mp = await prisma.materiaPrima.create({ data: { tenantId: tenant.id, nomeComercial: "Fosfato", prefixoLote: "FOS", categoria: "MACROMINERAL" } });
  const milho = await prisma.materiaPrima.create({ data: { tenantId: tenant.id, nomeComercial: "Milho", prefixoLote: "MIL", categoria: "MACROINGREDIENTE" } });
  const forn = await prisma.fornecedor.create({
    data: { tenantId: tenant.id, razaoSocial: "Forn", cnpj: "1", statusQualificacao: "APROVADO", materiasPrimas: { create: [{ materiaPrimaId: mp.id, homologado: true }, { materiaPrimaId: milho.id, homologado: true }] } },
  });
  // lote com RQ 1.2 (recebimento completo) e lote lançado sem inspeção (gera pendência)
  ids.fos = (await registrarRecebimento(ctx, { fornecedorId: forn.id, materiaPrimaId: mp.id, numeroNf: "882", quantidadeKg: 100, respostas: checklistOk, fotos: [] })).lote.id;
  ids.mil = (
    await prisma.loteMateriaPrima.create({
      data: { tenantId: tenant.id, materiaPrimaId: milho.id, fornecedorId: forn.id, codigoLoteInterno: `MIL-${uid}`, numeroNf: "1", quantidadeKg: 2000, status: "LIBERADO", aprovado: true },
    })
  ).id;
  ids.produto = (await prisma.produto.create({ data: { tenantId: tenant.id, codigo: "C1", nome: "Concentrado", tamanhoBateladaKg: 1000 } })).id;
  ids.op1 = await ordem("C1-A", [[ids.fos, 40], [ids.mil, 960]], 40, [["Fazenda Alfa", 30]]);
  ids.op2 = await ordem("C1-B", [[ids.fos, 40], [ids.mil, 960]], 40, [["Fazenda Beta", 10], ["Fazenda Alfa", 5]]);
  ids.op3 = await ordem("C1-C", [[ids.mil, 80]], 40, []); // não usa o fosfato; consumo abaixo do esperado
});
afterAll(() => prisma.$disconnect());

describe("recall em um clique", () => {
  it("lote de MP suspeito → lotes de produto, clientes e estoque", async () => {
    const r = await rastrearRecall(ctx.tenantId, "LOTE_MP", ids.fos);
    expect(r.ordens.map((o) => o.lote)).toEqual(["C1-A", "C1-B"]);
    expect(r.totais).toMatchObject({ ordens: 2, sacasProduzidas: 80, sacasExpedidas: 45, sacasEstoque: 35, clientes: 2, kgSuspeitoConsumido: 80 });
    expect(r.clientes[0]).toMatchObject({ nome: "Fazenda Alfa", sacas: 35 });
    expect(r.clientes[0].envios).toHaveLength(2);
    expect(r.lotesMp[0]).toMatchObject({ recebidoKg: 100, consumidoKg: 80, saldoKg: 20 });
    expect(r.pendencias).toEqual([]);
  });

  it("lote de produto reclamado → origem e recolhimento ampliado pelos insumos em comum", async () => {
    const r = await rastrearRecall(ctx.tenantId, "LOTE_PRODUTO", ids.op1);
    expect(r.lotesMp.map((l) => l.id).sort()).toEqual([ids.fos, ids.mil].sort());
    expect(r.ordens.map((o) => o.lote)).toEqual(["C1-A", "C1-B", "C1-C"]); // C1-C usa o mesmo milho
    expect(r.ordens.find((o) => o.alvo)!.lote).toBe("C1-A");
    expect(r.pendencias.some((p) => p.includes("sem registro de recebimento"))).toBe(true);
    expect(r.pendencias.some((p) => p.includes("C1-C") && p.includes("esperados"))).toBe(true);
  });

  it("simulado assinado registra o RQ 8.1 do semestre e fica imutável", async () => {
    const agora = new Date();
    const { registro, rqExecucaoId } = await registrarRecall(ctx, { tipo: "SIMULADO", alvoTipo: "LOTE_PRODUTO", alvoId: ids.op1, motivo: "Simulado semestral", iniciadoEm: new Date(agora.getTime() - 12 * 60_000) }, { agora });
    expect(registro.numero).toBe(1);
    expect(registro.duracaoMin).toBe(12);
    expect(registro.completo).toBe(false);
    expect(registro.hash).toHaveLength(64);
    const rq = await prisma.rqExecucao.findUniqueOrThrow({ where: { id: rqExecucaoId! } });
    expect(rq.codigoRq).toBe("RQ 8.1");
    expect(rq.status).toBe("NAO_CONFORME"); // rastreio com pendências
    expect((rq.respostas as Record<string, { valor: unknown }>).tempo_min.valor).toBe(12);
    const ncs = await prisma.naoConformidade.count({ where: { rqExecucaoId: rq.id } });
    expect(ncs).toBe(1);
    await expect(prisma.recallRegistro.update({ where: { id: registro.id }, data: { motivo: "x" } })).rejects.toThrow();
    await expect(prisma.recallRegistro.delete({ where: { id: registro.id } })).rejects.toThrow();
  });

  it("segundo simulado no semestre não duplica o RQ 8.1; recolhimento real não gera RQ", async () => {
    const agora = new Date();
    const s2 = await registrarRecall(ctx, { tipo: "SIMULADO", alvoTipo: "LOTE_MP", alvoId: ids.fos, motivo: "Treinamento", iniciadoEm: new Date(agora.getTime() - 3 * 60_000) }, { agora });
    expect(s2.registro.numero).toBe(2);
    expect(s2.registro.completo).toBe(true);
    expect(s2.rqExecucaoId).toBeNull();
    const real = await registrarRecall(ctx, { tipo: "REAL", alvoTipo: "LOTE_MP", alvoId: ids.fos, motivo: "Fornecedor comunicou contaminação", iniciadoEm: agora }, { agora });
    expect(real.rqExecucaoId).toBeNull();
  });

  it("valida motivo e cronômetro", async () => {
    const agora = new Date();
    await expect(registrarRecall(ctx, { tipo: "SIMULADO", alvoTipo: "LOTE_MP", alvoId: ids.fos, motivo: "", iniciadoEm: agora })).rejects.toThrow(/motivo/);
    await expect(registrarRecall(ctx, { tipo: "SIMULADO", alvoTipo: "LOTE_MP", alvoId: ids.fos, motivo: "Simulado", iniciadoEm: new Date(agora.getTime() - 25 * 3600_000) }, { agora })).rejects.toThrow(/24 horas/);
    await expect(registrarRecall(ctx, { tipo: "SIMULADO", alvoTipo: "LOTE_MP", alvoId: "inexistente", motivo: "Simulado", iniciadoEm: agora }, { agora })).rejects.toThrow(/não encontrado/);
  });
});

describe("rótulo e ZPL", () => {
  const base: DadosRotulo = {
    empresa: { razaoSocial: "Fábrica", cnpj: "1", registroMapa: "SP-1", endereco: "Rua 1", cidadeUf: "Cidade/SP" },
    produto: {
      codigo: "C1", nome: "Concentrado ^Teste~", categoria: "Concentrado", especieDestino: "Bovinos", registroProduto: "SP-1 0001", pesoSacariaKg: 25,
      niveisGarantia: [{ nutriente: "Proteína Bruta", valor: 220, unidade: "g/kg", tipo: "min" }], composicaoBasica: null, ingredientes: ["Milho", "Farelo de soja"],
      substitutivos: null, indicacaoUso: "Bovinos de corte", modoUso: "1% do PV", restricoes: null, conservacao: "Local seco", validadeDias: 90, versaoFormula: 2,
    },
    lote: { codigo: "C1-041026-01", fabricacao: new Date("2026-10-04T12:00:00Z"), validade: null },
  };

  it("aponta itens obrigatórios faltando", () => {
    expect(pendenciasRotulo(base)).toEqual([]);
    const falta = pendenciasRotulo({ ...base, empresa: { ...base.empresa, registroMapa: null }, produto: { ...base.produto, modoUso: null, niveisGarantia: [] } });
    expect(falta).toHaveLength(3);
    expect(pendenciasRotulo({ ...base, lote: null }, { exigirLote: true })).toContain("Lote e data de fabricação");
  });

  it("gera ZPL com tamanho, UTF-8, código de barras do lote, validade calculada e cópias", () => {
    const { zpl, cabe } = gerarZpl(base, { copias: 40 });
    expect(zpl.startsWith("^XA\n^CI28\n^PW800\n^LL1200")).toBe(true);
    expect(zpl).toContain("^BCN");
    expect(zpl).toContain("^FDC1-041026-01^FS");
    expect(zpl).toContain("VALIDADE: 02/01/2027");
    expect(zpl).toContain("Milho, Farelo de soja");
    expect(zpl).toContain("Proteína Bruta (mín.): 220 g/kg");
    expect(gerarZpl({ ...base, produto: { ...base.produto, niveisGarantia: [{ nutriente: "Umidade (máx.)", valor: 130, unidade: "g/kg", tipo: "max" }] } }).zpl).toContain("Umidade (máx.): 130 g/kg");
    expect(zpl).toContain("^PQ40,0,1,Y");
    expect(zpl.trim().endsWith("^XZ")).toBe(true);
    expect(zpl).not.toContain("^Teste");
    expect(cabe).toBe(true);
    expect(gerarZpl(base, { dpi: 300 }).zpl).toContain("^PW1200");
    expect(textoZpl("a^b~c\nd")).toBe("a-b-c d");
  });

  it("reduz a fonte quando o texto é longo e avisa se não couber", () => {
    const longo = { ...base, produto: { ...base.produto, modoUso: "Fornecer conforme orientação técnica. ".repeat(50) } };
    const normal = gerarZpl(base);
    const reduzido = gerarZpl(longo);
    expect(reduzido.fonteCorpo).toBeLessThan(normal.fonteCorpo);
    expect(gerarZpl({ ...base, produto: { ...base.produto, modoUso: "Texto muito longo. ".repeat(400) } }, { tamanho: "100x100" }).cabe).toBe(false);
  });
});

describe("dossiê de fiscalização", () => {
  it("valida o período", () => {
    expect(() => intervalo("2026-10-05", "2026-10-01")).toThrow(/posterior/);
    expect(() => intervalo("2025-01-01", "2026-10-01")).toThrow(/366/);
  });

  it("resume a cobertura da agenda por POP", async () => {
    const hoje = chaveDia(new Date());
    const { de, ate } = intervalo(chaveDia(new Date(Date.now() - 20 * 86_400_000)), hoje);
    const r = await resumoDossie(ctx.tenantId, de, ate);
    const rq21 = r.pops.find((p) => p.numero === 2)!.rqs.find((x) => x.codigoRq === "RQ 2.1")!;
    expect(rq21.esperados).toBeGreaterThanOrEqual(19); // dias vencidos no intervalo
    expect(rq21.cobertos).toBe(0);
    expect(r.pops.find((p) => p.numero === 1)!.rqs.find((x) => x.codigoRq === "RQ 1.2")!.esperados).toBeNull();
    expect(r.recalls).toBe(3);
    expect(r.cobertura).toBeLessThan(10);
  });

  it("gera o ZIP com índice, PDFs por POP, planilhas e manifesto SHA-256 conferível", async () => {
    const hoje = chaveDia(new Date());
    const { buffer, registros } = await gerarPacoteDossie(ctx, chaveDia(new Date(Date.now() - 30 * 86_400_000)), hoje);
    expect(registros).toBe(2); // RQ 1.2 + RQ 8.1
    const zip = await JSZip.loadAsync(buffer);
    const nomes = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    const raiz = nomes[0].split("/")[0];
    const rel = nomes.map((n) => n.slice(raiz.length + 1));
    expect(rel).toContain("00-Indice-e-resumo.pdf");
    expect(rel).toContain("Nao-conformidades.pdf");
    expect(rel).toContain("Trilha-de-auditoria.csv");
    expect(rel.some((n) => n.startsWith("POP-01 ") && n.includes("RQ-1.2 n0001"))).toBe(true);
    expect(rel.some((n) => n.startsWith("POP-08 ") && n.includes("RQ-8.1"))).toBe(true);
    expect(rel.filter((n) => n.startsWith("Recall/"))).toHaveLength(3);
    const manifesto = await zip.file(`${raiz}/MANIFESTO-SHA256.txt`)!.async("string");
    const [hash, arquivo] = manifesto.split("\n").find((l) => l.endsWith("Rastreabilidade/3-expedicao.csv"))!.split("  ");
    expect(sha256(await zip.file(`${raiz}/${arquivo}`)!.async("nodebuffer"))).toBe(hash);
    const expedicao = await zip.file(`${raiz}/Rastreabilidade/3-expedicao.csv`)!.async("string");
    expect(expedicao).toContain("Fazenda Beta");
    const auditoria = await prisma.auditLog.findFirst({ where: { tenantId: ctx.tenantId, acao: "GERACAO_DOSSIE" } });
    expect(auditoria).not.toBeNull();
  });
});
