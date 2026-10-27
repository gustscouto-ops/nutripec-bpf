import { describe, expect, it } from "vitest";
import { avaliarRespostas, type CampoRq } from "@/lib/rq/campos";
import { aplicarRegraLote, gerarCodigoUnico } from "@/lib/lote";
import { normalizarItens, validarSomaFormula } from "@/lib/servicos/formula";
import { hashAssinatura, jsonCanonico } from "@/lib/hash";
import { CAMPOS_RQ_1_2, CATALOGO_POPS } from "@/lib/rq/catalogo";
import { CATALOGO_ITS } from "@/lib/rq/instrucoes";

const campos: CampoRq[] = [
  { id: "lona", rotulo: "Lona íntegra", tipo: "conformidade" },
  { id: "umidade", rotulo: "Umidade", tipo: "numerico", max: 14, limiteDinamico: "umidadeMaxPct" },
];

describe("checklist RQ", () => {
  it("fica conforme quando tudo está dentro", () => {
    const r = avaliarRespostas(campos, { lona: { valor: "C" }, umidade: { valor: 12 } });
    expect(r.status).toBe("CONFORME");
    expect(r.erros).toEqual({});
  });

  it("bloqueia NC sem descrição e ação corretiva", () => {
    const r = avaliarRespostas(campos, { lona: { valor: "NC" }, umidade: { valor: 12 } });
    expect(r.erros.lona).toMatch(/ação corretiva/);
  });

  it("numérico fora do limite vira NC automaticamente", () => {
    const r = avaliarRespostas(campos, { lona: { valor: "C" }, umidade: { valor: 15 } });
    expect(r.erros.umidade).toBeDefined();
    const ok = avaliarRespostas(campos, {
      lona: { valor: "C" },
      umidade: { valor: 15, descricaoNc: "Umidade alta", acaoCorretiva: "Segregado para secagem" },
    });
    expect(ok.status).toBe("NAO_CONFORME");
    expect(ok.naoConformidades).toHaveLength(1);
  });

  it("usa o limite do cadastro da matéria-prima", () => {
    const r = avaliarRespostas(campos, { lona: { valor: "C" }, umidade: { valor: 13 } }, { umidadeMaxPct: 12.5 });
    expect(r.erros.umidade).toBeDefined();
  });

  it("exige todos os itens do RQ 1.2", () => {
    const r = avaliarRespostas(CAMPOS_RQ_1_2, {});
    expect(Object.keys(r.erros)).toHaveLength(CAMPOS_RQ_1_2.length);
  });
});

describe("lote interno", () => {
  const data = new Date("2026-10-03T15:00:00Z");
  it("aplica a regra padrão PREFIXO-DDMMAAAA", () => {
    expect(aplicarRegraLote("{PREFIXO}-{DDMMAAAA}", { PREFIXO: "bic", data })).toBe("BIC-03102026");
  });
  it("usa o fuso de Brasília (23h de 03/10 BRT ainda é dia 03)", () => {
    expect(aplicarRegraLote("{DD}{MM}", { data: new Date("2026-10-04T02:30:00Z") })).toBe("0310");
  });
  it("acrescenta sufixo quando o código já existe", async () => {
    const existentes = new Set(["BIC-03102026", "BIC-03102026-2"]);
    expect(await gerarCodigoUnico("{PREFIXO}-{DDMMAAAA}", { PREFIXO: "BIC", data }, async (c) => existentes.has(c))).toBe("BIC-03102026-3");
  });
  it("usa {SEQ} quando presente", async () => {
    const existentes = new Set(["C130-031026-01"]);
    expect(await gerarCodigoUnico("{CODIGO}-{DD}{MM}{AA}-{SEQ}", { CODIGO: "C130", data }, async (c) => existentes.has(c))).toBe("C130-031026-02");
  });
});

describe("fórmula", () => {
  it("converte base percentual em kg da batelada", () => {
    const { itens, soma } = normalizarItens({ base: "percentual", tamanhoBateladaKg: 1000, itens: [{ materiaPrimaId: "a", percentual: 62.5 }, { materiaPrimaId: "b", percentual: 37.5 }] });
    expect(soma).toBe(100);
    expect(itens[0].quantidadeBateladaKg).toBe(625);
  });
  it("converte base batelada em percentual", () => {
    const { itens } = normalizarItens({ base: "batelada", tamanhoBateladaKg: 1500, itens: [{ materiaPrimaId: "a", quantidadeBateladaKg: 675 }, { materiaPrimaId: "b", quantidadeBateladaKg: 825 }] });
    expect(itens[0].percentual).toBe(45);
  });
  it("recusa fórmula que não fecha 100%", () => {
    expect(() => validarSomaFormula(99.5)).toThrow(/100%/);
    expect(() => validarSomaFormula(100.005)).not.toThrow();
  });
  it("recusa matéria-prima repetida", () => {
    expect(() => normalizarItens({ base: "percentual", tamanhoBateladaKg: 1000, itens: [{ materiaPrimaId: "a", percentual: 50 }, { materiaPrimaId: "a", percentual: 50 }] })).toThrow(/repetida/);
  });
});

describe("hash da assinatura", () => {
  it("independe da ordem das chaves", () => {
    expect(hashAssinatura({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(hashAssinatura({ b: { d: [1, 2], c: 2 }, a: 1 }));
    expect(jsonCanonico({ b: 1, a: undefined })).toBe('{"b":1}');
  });
  it("muda quando o conteúdo muda", () => {
    expect(hashAssinatura({ umidade: 12 })).not.toBe(hashAssinatura({ umidade: 12.1 }));
  });
});

describe("catálogo dos 9 POPs", () => {
  it("segue a ordem dos manuais de BPF (IN 04/2007) e numera RQs e ITs pelo POP", () => {
    const temas = ["Fornecedores", "Limpeza", "Higiene e Saúde", "Água", "Contaminação Cruzada", "Manutenção e Calibração", "Pragas", "Resíduos", "Rastreabilidade"];
    expect(CATALOGO_POPS.map((p) => p.numeroPop)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    CATALOGO_POPS.forEach((p, i) => {
      expect(p.titulo).toContain(temas[i]);
      for (const rq of p.rqs) expect(rq.codigoRq.startsWith(`RQ ${p.numeroPop}.`)).toBe(true);
    });
    for (const it of CATALOGO_ITS) expect(it.codigo.startsWith(`IT 0${it.popNumero}.`)).toBe(true);
    expect(CATALOGO_POPS[8].rqs[0].codigoRq).toBe("RQ 9.1"); // simulado de recall
  });
});
