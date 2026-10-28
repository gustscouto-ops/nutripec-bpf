import { describe, expect, it } from "vitest";
import { gruposAutoControles, linkAtivo } from "@/lib/menu";
import { CATALOGO_POPS } from "@/lib/rq/catalogo";

const modelos = CATALOGO_POPS.flatMap((p) => p.rqs.map((r) => ({ id: r.codigoRq.replace(" ", "-"), codigoRq: r.codigoRq, titulo: r.titulo, popNumero: p.numeroPop })));

describe("menu Auto controles", () => {
  const grupos = gruposAutoControles(modelos, { podeRegistrar: true, atrasadasPorRq: new Map([["RQ 2.1", 2], ["RQ 1.2", 1]]) });
  const hrefs = (n: number) => grupos[n - 1].filhos.map((f) => f.href);

  it("tem os POPs 01 a 09 em ordem", () => {
    expect(grupos.map((g) => g.rotulo)).toEqual(["POP 01", "POP 02", "POP 03", "POP 04", "POP 05", "POP 06", "POP 07", "POP 08", "POP 09"]);
  });

  it("move as telas para dentro dos POPs certos", () => {
    expect(hrefs(1).slice(0, 3)).toEqual(["/fornecedores", "/materias-primas", "/recebimento"]);
    expect(hrefs(5)[0]).toBe("/produtos");
    expect(hrefs(9).slice(0, 4)).toEqual(["/producao", "/expedicao", "/rastreabilidade", "/recall"]);
  });

  it("lista os RQs do POP (o 1.2 fica na tela de Recebimento) e o histórico", () => {
    const pop1 = grupos[0].filhos.map((f) => f.rotulo);
    expect(pop1.some((r) => r.startsWith("RQ 1.1"))).toBe(true);
    expect(pop1.some((r) => r.startsWith("RQ 1.2"))).toBe(false);
    expect(hrefs(2)).toContain("/rqs/novo?modelo=RQ-2.1");
    expect(hrefs(2).at(-1)).toBe("/rqs?pop=2");
  });

  it("soma os atrasados no POP", () => {
    expect(grupos[0].contador).toBe(1);
    expect(grupos[1].contador).toBe(2);
    expect(grupos[2].contador).toBeUndefined();
  });

  it("quem não registra abre o histórico do RQ", () => {
    const g = gruposAutoControles(modelos, { podeRegistrar: false });
    expect(g[1].filhos.map((f) => f.href)).toContain("/rqs?rq=RQ%202.1");
  });

  it("marca o link ativo considerando a query", () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(linkAtivo("/rqs/novo?modelo=a", "/rqs/novo", q("modelo=a&ref=2026-10-28"))).toBe(true);
    expect(linkAtivo("/rqs/novo?modelo=a", "/rqs/novo", q("modelo=b"))).toBe(false);
    expect(linkAtivo("/recebimento", "/recebimento/novo", q(""))).toBe(true);
    expect(linkAtivo("/produtos", "/producao", q(""))).toBe(false);
    expect(linkAtivo("/", "/tarefas", q(""))).toBe(false);
  });
});
