const TZ = "America/Sao_Paulo";

export const dataHora = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "—";

export const data = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—";

export const numero = (v: number | string | null | undefined, casas = 0) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const kg = (v: number | string | null | undefined) => `${numero(v, Number(v) % 1 ? 2 : 0)} kg`;

export const ROTULO_STATUS_LOTE = { LIBERADO: "Liberado", QUARENTENA: "Quarentena", REPROVADO: "Reprovado" } as const;
export const COR_STATUS_LOTE = { LIBERADO: "verde", QUARENTENA: "amarelo", REPROVADO: "vermelho" } as const;

export const ROTULO_QUALIFICACAO = { APROVADO: "Aprovado", REPROVADO: "Reprovado", EM_AVALIACAO: "Em avaliação" } as const;
export const COR_QUALIFICACAO = { APROVADO: "verde", REPROVADO: "vermelho", EM_AVALIACAO: "amarelo" } as const;

export const ROTULO_FORMULA = { RASCUNHO: "Rascunho", AGUARDANDO_RT: "Aguardando RT", APROVADA: "Aprovada pelo RT" } as const;
export const COR_FORMULA = { RASCUNHO: "amarelo", AGUARDANDO_RT: "azul", APROVADA: "verde" } as const;

export const ROTULO_CATEGORIA: Record<string, string> = {
  MACROINGREDIENTE: "Macroingrediente",
  MICROMINERAL: "Micromineral",
  MACROMINERAL: "Macromineral",
  VITAMINA: "Vitamina",
  PREMIX: "Premix",
  NUCLEO: "Núcleo",
  ADITIVO: "Aditivo",
  MEDICAMENTO: "Medicamento",
  EMBALAGEM: "Embalagem",
  OUTRO: "Outro",
};

export const ROTULO_TURNO = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" } as const;
