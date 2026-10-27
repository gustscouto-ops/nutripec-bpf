/**
 * RQs da fábrica: controle de revisão, cabeçalho/rodapé da empresa, verificação (monitor + verificador)
 * e PDFs do registro preenchido e do formulário em branco.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { sincronizarCatalogo } from "@/lib/rq/sincronizar";
import { CATALOGO_POPS } from "@/lib/rq/catalogo";
import { padraoDoCampo, type CampoRq } from "@/lib/rq/campos";
import { modeloEfetivo, modelosEfetivos, registrarExecucaoRq } from "@/lib/servicos/rq";
import { criarModelo, historicoRevisoes, resumoAlteracoes, salvarModelo } from "@/lib/servicos/modelos";
import { dadosIdentidade, salvarIdentidade } from "@/lib/servicos/identidade";
import { verificarRq } from "@/lib/servicos/verificacao";
import { pdfFormulariosEmBranco, pdfRq } from "@/lib/pdf/rq";

const uid = randomUUID().slice(0, 8);
const AGORA = new Date("2026-10-07T13:00:00Z");
let rt: Ctx;
let operador: Ctx;

async function usuario(tenantId: string, nome: string, perfil: Ctx["perfil"]): Promise<Ctx> {
  const u = await prisma.user.create({ data: { nome, email: `${nome.replace(/\W/g, "")}-${uid}@teste`, senhaHash: "x", registroProfissional: perfil === "RT" ? "CRMV/MG 1627/Z" : null } });
  await prisma.membership.create({ data: { userId: u.id, tenantId, perfil } });
  return { userId: u.id, nome, tenantId, tenantNome: "Leal", perfil, ip: "10.0.0.1" };
}

/** PNG 1x1 válido para testar o logo. */
function pngMinimo() {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloco = (tipo: string, dados: Buffer) => {
    const t = Buffer.concat([Buffer.from(tipo), dados]);
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([tam, t, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(Buffer.from([0, 19, 106, 61]))), bloco("IEND", Buffer.alloc(0))]);
}

/** Texto do PDF via pdftotext (poppler); sem a ferramenta, os testes de texto são pulados. */
function textoPdf(pdf: Buffer): string | null {
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "rq-"));
    const arq = path.join(dir, "rq.pdf");
    writeFileSync(arq, pdf);
    return execFileSync("pdftotext", ["-layout", arq, "-"], { encoding: "utf8" });
  } catch {
    return null;
  }
}

beforeAll(async () => {
  await sincronizarCatalogo(prisma);
  const tenant = await prisma.tenant.create({ data: { razaoSocial: `Leal Nutrição Animal ${uid}`, nomeFantasia: "Leal", cnpj: `rqf-${uid}`, createdAt: new Date("2026-09-01T12:00:00Z") } });
  rt = await usuario(tenant.id, "Gustavo Souza Couto", "RT");
  operador = await usuario(tenant.id, "Ana Luiza Batista", "OPERADOR");
});
afterAll(() => prisma.$disconnect());

describe("catálogo revisto pela IN 04/2007", () => {
  it("todo RQ padrão tem orientações e códigos únicos; itens citam o requisito da IN", () => {
    const rqs = CATALOGO_POPS.flatMap((p) => p.rqs);
    expect(new Set(rqs.map((r) => r.codigoRq)).size).toBe(rqs.length);
    expect(rqs.length).toBe(23); // eram 16 antes da revisão pela IN 04/2007
    for (const r of rqs) expect(r.orientacoes).toMatch(/IN 04\/2007/);
    expect(rqs.find((r) => r.codigoRq === "RQ 6.3")!.titulo).toBe("Aferição das Balanças");
    expect(rqs.find((r) => r.codigoRq === "RQ 9.2")!.orientacoes).toContain("8.1");
  });

  it("sincronizar de novo não cria revisão quando nada mudou", async () => {
    const antes = await prisma.rqModeloRevisao.count({ where: { tenantId: null } });
    await sincronizarCatalogo(prisma);
    expect(await prisma.rqModeloRevisao.count({ where: { tenantId: null } })).toBe(antes);
  });

  it("mostra o padrão de cada item no formulário", () => {
    expect(padraoDoCampo({ id: "a", rotulo: "Cloro", tipo: "numerico", min: 0.2, max: 2, unidade: "mg/L" })).toBe("0,2 a 2 mg/L");
    expect(padraoDoCampo({ id: "b", rotulo: "Capturas", tipo: "numerico", min: 0, max: 0, unidade: "un" })).toBe("0 un");
    expect(padraoDoCampo({ id: "c", rotulo: "Pragas", tipo: "conformidade", padrao: "Ausência" })).toBe("Ausência");
  });
});

describe("controle de revisão dos RQs", () => {
  it("resume o que mudou entre revisões", () => {
    const base = { titulo: "Aferição", frequencia: "SEMANAL" as const, diaSemana: 5, diaMes: null, orientacoes: null, registrosPorFolha: null };
    const a: CampoRq[] = [{ id: "x", rotulo: "Balança 1", tipo: "numerico", min: -0.5, max: 0.5 }, { id: "y", rotulo: "Balança 2", tipo: "numerico" }];
    const b: CampoRq[] = [{ id: "x", rotulo: "Balança 1", tipo: "numerico", min: -1, max: 1 }, { id: "z", rotulo: "Balança 3", tipo: "numerico" }];
    const r = resumoAlteracoes({ ...base, campos: a }, { ...base, titulo: "Aferição das balanças", campos: b });
    expect(r).toContain('Título: "Aferição" para "Aferição das balanças"');
    expect(r).toContain("Item incluído: Balança 3");
    expect(r).toContain("Item excluído: Balança 2");
    expect(r.some((m) => m.startsWith("Item alterado (padrão"))).toBe(true);
  });

  it("personalizar com o número do papel grava a revisão 07 com data, motivo e resumo", async () => {
    const padrao = (await modeloEfetivo(rt.tenantId, "RQ 6.3"))!;
    const campos = [...(padrao.campos as CampoRq[]), { rotulo: "Balança de minerais (Prix 300 kg): erro", tipo: "numerico" as const, unidade: "%", min: -0.5, max: 0.5 }];
    const salvo = await salvarModelo(rt, padrao.id, {
      titulo: "Aferição dos Instrumentos (Balança)",
      frequencia: "SEMANAL",
      diaSemana: 5,
      ativo: true,
      campos,
      orientacoes: "Peso calibrado para aferição: 20 kg. Observar a IT 01 do POP 06.",
      registrosPorFolha: 5,
      motivo: "Inclusão da balança de minerais",
      revisao: 7,
      dataRevisao: "2026-05-08",
    });
    expect(salvo.versao).toBe(7);
    expect(salvo.tenantId).toBe(rt.tenantId);
    const hist = await historicoRevisoes(rt.tenantId, "RQ 6.3");
    expect(hist[0]).toMatchObject({ revisao: 7, motivo: "Inclusão da balança de minerais", tenantId: rt.tenantId });
    expect(hist[0].alteracoes).toContain("Item incluído: Balança de minerais");
    expect(hist[0].dataRevisao.toISOString().slice(0, 10)).toBe("2026-05-08");
    expect(hist.at(-1)!.tenantId).toBeNull(); // a origem no modelo padrão continua no histórico
  });

  it("nova alteração sobe para 08; revisão menor é recusada; mudar só o 'ativo' não revisa", async () => {
    const m = (await modeloEfetivo(rt.tenantId, "RQ 6.3"))!;
    const base = { titulo: m.titulo, frequencia: m.frequencia, diaSemana: m.diaSemana, ativo: true, campos: m.campos as CampoRq[], orientacoes: m.orientacoes, registrosPorFolha: m.registrosPorFolha };
    await expect(salvarModelo(rt, m.id, { ...base, titulo: "Aferição semanal", revisao: 7 })).rejects.toThrow(/maior que a atual \(07\)/);
    const r8 = await salvarModelo(rt, m.id, { ...base, titulo: "Aferição semanal", motivo: "Título padronizado" });
    expect(r8.versao).toBe(8);
    const igual = await salvarModelo(rt, m.id, { ...base, titulo: "Aferição semanal", ativo: false });
    expect(igual.versao).toBe(8);
    expect((await salvarModelo(rt, m.id, { ...base, titulo: "Aferição semanal", ativo: true })).versao).toBe(8);
    expect(await prisma.rqModeloRevisao.count({ where: { tenantId: rt.tenantId, codigoRq: "RQ 6.3" } })).toBe(2);
  });

  it("histórico de revisões é imutável", async () => {
    const r = await prisma.rqModeloRevisao.findFirstOrThrow({ where: { tenantId: rt.tenantId } });
    await expect(prisma.rqModeloRevisao.update({ where: { id: r.id }, data: { motivo: "x" } })).rejects.toThrow(/imutável/);
    await expect(prisma.rqModeloRevisao.delete({ where: { id: r.id } })).rejects.toThrow(/imutável/);
  });

  it("RQ novo da empresa nasce com a revisão 01 no histórico", async () => {
    const pop6 = await prisma.pop.findUniqueOrThrow({ where: { numeroPop: 6 } });
    const novo = await criarModelo(rt, { popId: pop6.id, codigoRq: "RQ 6.9", titulo: "Termômetro do depósito", frequencia: "MENSAL" });
    const hist = await historicoRevisoes(rt.tenantId, "RQ 6.9");
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ revisao: novo.versao, motivo: "Emissão inicial" });
  });
});

describe("cabeçalho e rodapé da empresa", () => {
  it("sugere dados do cadastro e salva logo e responsáveis", async () => {
    const sugestao = await dadosIdentidade(rt.tenantId);
    expect(sugestao).toMatchObject({ salvo: false, nomeCabecalho: "LEAL", rtNome: "Gustavo Souza Couto", rtRegistro: "CRMV/MG 1627/Z" });
    await expect(salvarIdentidade(rt, { ...sugestao, rtNome: "" })).rejects.toThrow(/destacados/);
    await expect(salvarIdentidade(rt, sugestao, { conteudo: Buffer.from("gif"), mime: "image/gif" })).rejects.toThrow(/PNG ou JPG/);
    await salvarIdentidade(rt, { nomeCabecalho: "LEAL NUTRIÇÃO ANIMAL", rtNome: "Gustavo Souza Couto", rtRegistro: "CRMV/MG 1627/Z", controleQualidade: "Ana Luíza Batista de Jesus", proprietario: "Gleison Ferreira Leal" }, { conteudo: pngMinimo(), mime: "image/png" });
    const salva = await dadosIdentidade(rt.tenantId);
    expect(salva).toMatchObject({ salvo: true, proprietario: "Gleison Ferreira Leal", logoMime: "image/png" });
    expect(salva.logoArquivo).toBeTruthy();
  });
});

describe("verificação e PDFs", () => {
  let rqId: string;

  it("monitor assina, ele mesmo não pode verificar, e o RT verifica uma única vez", async () => {
    const m = (await modeloEfetivo(rt.tenantId, "RQ 6.3"))!;
    const respostas = Object.fromEntries((m.campos as CampoRq[]).map((c) => [c.id, { valor: c.tipo === "numerico" ? 0.1 : "Peso padrão 20 kg nº 01" }]));
    const { execucao } = await registrarExecucaoRq(operador, { modeloId: m.id, respostas, fotos: [] }, { agora: AGORA });
    rqId = execucao.id;
    expect(execucao.versaoModelo).toBe(8);
    await expect(verificarRq(operador, rqId)).rejects.toThrow(/outra pessoa/);
    const v = await verificarRq(rt, rqId, "Conferido.");
    expect(v.hash).toHaveLength(64);
    expect(v.registroProfissional).toBe("CRMV/MG 1627/Z");
    await expect(verificarRq(rt, rqId)).rejects.toThrow(/já foi verificado/);
    await expect(prisma.rqVerificacao.update({ where: { id: v.id }, data: { parecer: "x" } })).rejects.toThrow(/imutável/);
  });

  it("registro não conforme exige parecer do verificador", async () => {
    const m = (await modeloEfetivo(rt.tenantId, "RQ 6.3"))!;
    const respostas = Object.fromEntries(
      (m.campos as CampoRq[]).map((c) => [c.id, c.id === "balanca_macro" ? { valor: 1.2, descricaoNc: "Erro de 1,2% na balança", acaoCorretiva: "Balança bloqueada e técnico acionado" } : { valor: c.tipo === "numerico" ? 0 : "20 kg" }]),
    );
    const { execucao } = await registrarExecucaoRq(operador, { modeloId: m.id, referencia: "2026-09-30", respostas, fotos: [] }, { agora: AGORA });
    await expect(verificarRq(rt, execucao.id, "")).rejects.toThrow(/parecer/);
    await verificarRq(rt, execucao.id, "Balança recalibrada; produto do período reavaliado.");
  });

  it("PDF do registro sai com o cabeçalho da empresa, a revisão 08 e as duas assinaturas", async () => {
    const pdf = (await pdfRq(rt.tenantId, rqId))!;
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const texto = textoPdf(pdf);
    if (texto === null) return;
    expect(texto).toContain("LEAL NUTRIÇÃO ANIMAL");
    expect(texto).toMatch(/Código: RQ 6\.3 \/ POP 06/);
    expect(texto).toContain("Revisão: 08");
    expect(texto).toContain("Aferição semanal");
    expect(texto).toContain("Ana Luiza Batista"); // monitor
    expect(texto).toMatch(/VERIFICADO POR[\s\S]*Gustavo Souza Couto/);
    expect(texto).toContain("Gleison Ferreira Leal"); // aprovado por (rodapé)
    expect(texto).toContain("(Controle de Qualidade)");
  });

  it("formulário em branco do POP traz os RQs vigentes, campos para monitor/verificador e relatório de NC", async () => {
    const modelos = (await modelosEfetivos(rt.tenantId)).filter((m) => m.pop.numeroPop === 6);
    const pdf = await pdfFormulariosEmBranco(rt.tenantId, modelos, "POP 06");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const texto = textoPdf(pdf);
    if (texto === null) return;
    for (const c of ["RQ 6.1", "RQ 6.2", "RQ 6.9"]) expect(texto).toContain(`Código: ${c} / POP 06`);
    expect(texto).toContain("Revisão: 08");
    expect(texto).toContain("5ª semana");
    expect(texto).toContain("Balança de minerais (Prix 300 kg): erro");
    expect(texto).toContain("Peso calibrado para aferição: 20 kg");
    expect(texto).toContain("RELATÓRIO DE NÃO CONFORMIDADE");
    expect(texto).toContain("Restauração das condições sanitárias");
    expect(texto).toMatch(/Verificado por:/);
  });

  it("formulário diário em branco usa a grade do mês", async () => {
    const m = (await modeloEfetivo(rt.tenantId, "RQ 2.1"))!;
    const texto = textoPdf(await pdfFormulariosEmBranco(rt.tenantId, [m], "RQ 2.1"));
    if (texto === null) return;
    expect(texto).toContain("Mês/Ano");
    expect(texto).toMatch(/16\s+17|17\s+18/);
    expect(texto).toContain("Verificador (rubrica)");
  });
});
