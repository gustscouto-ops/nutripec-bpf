import type { Frequencia } from "@prisma/client";

/**
 * Períodos da agenda de RQs, sempre no horário de Brasília (UTC−3, sem horário de verão desde 2019).
 * Módulo puro: usado pelo servidor (tarefas, atrasos) e pelo cliente (rótulos).
 */

export type Periodo = {
  inicio: Date; // 00:00 do primeiro dia (BRT)
  fim: Date; // 00:00 do dia seguinte ao último dia (exclusivo)
  vencimento: Date; // a partir deste instante o período está atrasado
  rotulo: string;
  chave: string; // AAAA-MM-DD do início
};

export type ConfigAgenda = { diaSemana?: number | null; diaMes?: number | null };

const OFFSET_H = 3;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Componentes da data no fuso de Brasília. */
export function partesBrt(d: Date) {
  const s = new Date(d.getTime() - OFFSET_H * 3600_000);
  const dowJs = s.getUTCDay(); // 0 = domingo
  return { a: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(), dow: dowJs === 0 ? 7 : dowJs };
}

/** 00:00 BRT do dia informado (aceita estouro: dia 32 vira o dia 1 do mês seguinte). */
export function meiaNoite(a: number, m: number, d: number) {
  return new Date(Date.UTC(a, m - 1, d, OFFSET_H));
}

export function chaveDia(d: Date) {
  const p = partesBrt(d);
  return `${p.a}-${pad(p.m)}-${pad(p.d)}`;
}

export function deChave(chave: string) {
  const [a, m, d] = chave.split("-").map(Number);
  if (!a || !m || !d) throw new Error("Data inválida");
  return meiaNoite(a, m, d);
}

const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const dm = (d: Date) => {
  const p = partesBrt(d);
  return `${pad(p.d)}/${pad(p.m)}`;
};

export function agendada(frequencia: Frequencia) {
  return frequencia !== "QUANDO_OCORRE" && frequencia !== "PERIODICA";
}

/** Período da agenda que contém a data. Retorna null para RQs "quando ocorre". */
export function periodoDe(frequencia: Frequencia, data: Date, cfg: ConfigAgenda = {}): Periodo | null {
  const { a, m, d, dow } = partesBrt(data);
  let inicio: Date, fim: Date, vencimento: Date, rotulo: string;
  switch (frequencia) {
    case "DIARIA":
      inicio = meiaNoite(a, m, d);
      fim = meiaNoite(a, m, d + 1);
      vencimento = fim;
      rotulo = `${pad(d)}/${pad(m)}/${a}`;
      break;
    case "SEMANAL": {
      const seg = d - (dow - 1);
      inicio = meiaNoite(a, m, seg);
      fim = meiaNoite(a, m, seg + 7);
      const venc = Math.min(Math.max(cfg.diaSemana ?? 5, 1), 7); // padrão: sexta-feira
      vencimento = meiaNoite(a, m, seg + venc);
      rotulo = `Semana de ${dm(inicio)} a ${dm(new Date(fim.getTime() - 1))}`;
      break;
    }
    case "QUINZENAL": {
      const primeira = d <= 15;
      inicio = meiaNoite(a, m, primeira ? 1 : 16);
      fim = primeira ? meiaNoite(a, m, 16) : meiaNoite(a, m + 1, 1);
      vencimento = fim;
      rotulo = `${primeira ? "1ª" : "2ª"} quinzena de ${MESES[m - 1]}/${a}`;
      break;
    }
    case "MENSAL": {
      inicio = meiaNoite(a, m, 1);
      fim = meiaNoite(a, m + 1, 1);
      vencimento = cfg.diaMes ? meiaNoite(a, m, Math.min(cfg.diaMes, ultimoDia(a, m)) + 1) : fim;
      rotulo = `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)}/${a}`;
      break;
    }
    case "SEMESTRAL": {
      const s1 = m <= 6;
      inicio = meiaNoite(a, s1 ? 1 : 7, 1);
      fim = s1 ? meiaNoite(a, 7, 1) : meiaNoite(a + 1, 1, 1);
      vencimento = fim;
      rotulo = `${s1 ? "1º" : "2º"} semestre/${a}`;
      break;
    }
    case "ANUAL":
      inicio = meiaNoite(a, 1, 1);
      fim = meiaNoite(a + 1, 1, 1);
      vencimento = fim;
      rotulo = String(a);
      break;
    default:
      return null;
  }
  return { inicio, fim, vencimento, rotulo, chave: chaveDia(inicio) };
}

export function periodoAnterior(frequencia: Frequencia, p: Periodo, cfg: ConfigAgenda = {}) {
  return periodoDe(frequencia, new Date(p.inicio.getTime() - 1), cfg)!;
}

/** Quantos períodos passados a agenda ainda cobra como atrasados. */
export const PERIODOS_COBRADOS: Partial<Record<Frequencia, number>> = { DIARIA: 7, SEMANAL: 2 };
export const periodosCobrados = (f: Frequencia) => PERIODOS_COBRADOS[f] ?? 1;

/** Dia de referência para RQs "quando ocorre": o próprio dia do registro. */
export function periodoDoDia(data: Date): Periodo {
  return periodoDe("DIARIA", data)!;
}
