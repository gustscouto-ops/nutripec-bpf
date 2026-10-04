import { describe, expect, it } from "vitest";
import { chaveDia, periodoAnterior, periodoDe, periodoDoDia } from "@/lib/agenda";

// quarta-feira, 07/10/2026, 10:00 em Brasília
const QUARTA = new Date("2026-10-07T13:00:00Z");

describe("agenda de RQs (horário de Brasília)", () => {
  it("usa o dia de Brasília, não o UTC", () => {
    expect(chaveDia(new Date("2026-10-07T02:30:00Z"))).toBe("2026-10-06");
    expect(chaveDia(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-07");
  });

  it("diária: vence à meia-noite", () => {
    const p = periodoDe("DIARIA", QUARTA)!;
    expect(p.chave).toBe("2026-10-07");
    expect(p.inicio.toISOString()).toBe("2026-10-07T03:00:00.000Z");
    expect(p.vencimento.toISOString()).toBe("2026-10-08T03:00:00.000Z");
    expect(periodoAnterior("DIARIA", p).chave).toBe("2026-10-06");
  });

  it("semanal: segunda a domingo, prazo padrão na sexta", () => {
    const p = periodoDe("SEMANAL", QUARTA)!;
    expect(p.chave).toBe("2026-10-05");
    expect(p.fim.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(p.vencimento.toISOString()).toBe("2026-10-10T03:00:00.000Z");
    expect(p.rotulo).toBe("Semana de 05/10 a 11/10");
  });

  it("semanal com prazo na quarta vence ao fim da quarta", () => {
    const p = periodoDe("SEMANAL", QUARTA, { diaSemana: 3 })!;
    expect(p.vencimento.toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(periodoDe("SEMANAL", new Date("2026-10-11T15:00:00Z"))!.chave).toBe("2026-10-05");
  });

  it("quinzenal e mensal", () => {
    expect(periodoDe("QUINZENAL", new Date("2026-10-20T15:00:00Z"))!.rotulo).toBe("2ª quinzena de outubro/2026");
    const m = periodoDe("MENSAL", QUARTA, { diaMes: 10 })!;
    expect(m.rotulo).toBe("Outubro/2026");
    expect(m.vencimento.toISOString()).toBe("2026-10-11T03:00:00.000Z");
    expect(periodoDe("MENSAL", new Date("2026-02-10T15:00:00Z"), { diaMes: 30 })!.vencimento.toISOString()).toBe("2026-03-01T03:00:00.000Z");
  });

  it("semestral, anual e quando ocorre", () => {
    expect(periodoDe("SEMESTRAL", QUARTA)!.rotulo).toBe("2º semestre/2026");
    expect(periodoDe("ANUAL", QUARTA)!.chave).toBe("2026-01-01");
    expect(periodoDe("QUANDO_OCORRE", QUARTA)).toBeNull();
    expect(periodoDoDia(QUARTA).chave).toBe("2026-10-07");
  });
});
