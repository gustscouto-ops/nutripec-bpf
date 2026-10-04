/**
 * Motor de checklists (RQs). Os campos de cada RQ ficam em rq_modelos.campos (JSON),
 * o que já prepara o customizador de formulários da Fase 2.
 * Este módulo é puro (sem banco) e roda no cliente e no servidor.
 */

export type TipoCampo = "conformidade" | "numerico" | "texto";

export type CampoRq = {
  id: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  ajuda?: string;
  unidade?: string;
  min?: number;
  max?: number;
  /** Para numéricos: nome do limite que pode vir do cadastro da matéria-prima. */
  limiteDinamico?: "umidadeMaxPct" | "temperaturaMaxC";
};

export type Resposta = {
  valor?: string | number | null; // "C" | "NC" | "NA" para conformidade
  conforme?: boolean;
  descricaoNc?: string;
  acaoCorretiva?: string;
};

export type Respostas = Record<string, Resposta>;

export type Limites = Partial<Record<NonNullable<CampoRq["limiteDinamico"]>, number | null>>;

export type ResultadoAvaliacao = {
  status: "CONFORME" | "NAO_CONFORME";
  erros: Record<string, string>;
  respostas: Respostas;
  naoConformidades: { campoId: string; rotulo: string; descricaoNc: string; acaoCorretiva: string }[];
};

export function faixaDoCampo(campo: CampoRq, limites: Limites = {}) {
  const maxDinamico = campo.limiteDinamico ? limites[campo.limiteDinamico] : undefined;
  return {
    min: campo.min,
    max: maxDinamico ?? campo.max,
  };
}

/** Indica se a resposta de um campo é não conforme (sem considerar descrição). */
export function respostaNaoConforme(campo: CampoRq, r: Resposta | undefined, limites: Limites = {}): boolean {
  if (!r || r.valor === undefined || r.valor === null || r.valor === "") return false;
  if (campo.tipo === "conformidade") return r.valor === "NC";
  if (campo.tipo === "numerico") {
    const v = Number(r.valor);
    if (Number.isNaN(v)) return false;
    const { min, max } = faixaDoCampo(campo, limites);
    return (min !== undefined && v < min) || (max !== undefined && max !== null && v > max);
  }
  return false;
}

const MIN_TEXTO_NC = 5;

/**
 * Valida o preenchimento. Uma não conformidade bloqueia o fechamento até que
 * a descrição do ocorrido e a ação corretiva imediata sejam informadas.
 */
export function avaliarRespostas(campos: CampoRq[], entrada: Respostas, limites: Limites = {}): ResultadoAvaliacao {
  const erros: Record<string, string> = {};
  const respostas: Respostas = {};
  const naoConformidades: ResultadoAvaliacao["naoConformidades"] = [];

  for (const campo of campos) {
    const r = entrada[campo.id] ?? {};
    const vazio = r.valor === undefined || r.valor === null || r.valor === "";
    if (vazio) {
      if (campo.obrigatorio !== false) erros[campo.id] = "Preenchimento obrigatório";
      continue;
    }
    if (campo.tipo === "conformidade" && !["C", "NC", "NA"].includes(String(r.valor))) {
      erros[campo.id] = "Resposta inválida";
      continue;
    }
    if (campo.tipo === "numerico" && Number.isNaN(Number(r.valor))) {
      erros[campo.id] = "Informe um número";
      continue;
    }
    const nc = respostaNaoConforme(campo, r, limites);
    const normal: Resposta = {
      valor: campo.tipo === "numerico" ? Number(r.valor) : String(r.valor).trim(),
      conforme: !nc,
    };
    if (nc) {
      const descricaoNc = (r.descricaoNc ?? "").trim();
      const acaoCorretiva = (r.acaoCorretiva ?? "").trim();
      if (descricaoNc.length < MIN_TEXTO_NC || acaoCorretiva.length < MIN_TEXTO_NC) {
        erros[campo.id] = "Não conformidade: descreva o ocorrido e a ação corretiva imediata";
        continue;
      }
      normal.descricaoNc = descricaoNc;
      normal.acaoCorretiva = acaoCorretiva;
      naoConformidades.push({ campoId: campo.id, rotulo: campo.rotulo, descricaoNc, acaoCorretiva });
    }
    respostas[campo.id] = normal;
  }

  return {
    status: naoConformidades.length ? "NAO_CONFORME" : "CONFORME",
    erros,
    respostas,
    naoConformidades,
  };
}
