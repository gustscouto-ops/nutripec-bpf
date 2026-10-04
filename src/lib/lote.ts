/**
 * Geração de códigos de lote a partir de uma regra configurável por empresa.
 * Ex.: "{PREFIXO}-{DDMMAAAA}" → BIC-03102026
 *      "{CODIGO}-{DD}{MM}{AA}-{SEQ}" → C130-031026-01
 */

const pad = (n: number, t = 2) => String(n).padStart(t, "0");

export function partesData(data: Date, fusoHorario = "America/Sao_Paulo") {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoHorario,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const p = Object.fromEntries(fmt.formatToParts(data).map((x) => [x.type, x.value]));
  return { DD: p.day, MM: p.month, AAAA: p.year, AA: p.year.slice(2) };
}

export function aplicarRegraLote(
  regra: string,
  vars: { PREFIXO?: string; CODIGO?: string; data: Date; seq?: number },
): string {
  const d = partesData(vars.data);
  const valores: Record<string, string> = {
    PREFIXO: (vars.PREFIXO ?? "").toUpperCase(),
    CODIGO: (vars.CODIGO ?? "").toUpperCase(),
    DD: d.DD,
    MM: d.MM,
    AA: d.AA,
    AAAA: d.AAAA,
    DDMMAAAA: `${d.DD}${d.MM}${d.AAAA}`,
    SEQ: pad(vars.seq ?? 1),
  };
  return regra.replace(/\{(\w+)\}/g, (m, token: string) => valores[token] ?? m);
}

/**
 * Gera um código único. Se a regra não tiver {SEQ} e o código já existir
 * (duas cargas da mesma matéria-prima no mesmo dia), acrescenta um sufixo -2, -3...
 */
export async function gerarCodigoUnico(
  regra: string,
  vars: { PREFIXO?: string; CODIGO?: string; data: Date },
  existe: (codigo: string) => Promise<boolean>,
): Promise<string> {
  const temSeq = regra.includes("{SEQ}");
  for (let seq = 1; seq < 1000; seq++) {
    let codigo = aplicarRegraLote(regra, { ...vars, seq });
    if (!temSeq && seq > 1) codigo = `${codigo}-${seq}`;
    if (!(await existe(codigo))) return codigo;
  }
  throw new Error("Não foi possível gerar um código de lote único");
}
