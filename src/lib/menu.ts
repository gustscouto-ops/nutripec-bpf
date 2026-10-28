import { CODIGO_RQ_RECEBIMENTO } from "./rq/codigos";

/** Itens do menu lateral. Um grupo (POP) abre ao clicar e mostra as telas e os RQs dele. */
export type LinkMenu = { href: string; rotulo: string; icone: string; contador?: number };
export type GrupoMenu = { grupo: string; rotulo: string; subtitulo?: string; icone: string; contador?: number; filhos: LinkMenu[] };
export type ItemMenu = LinkMenu | GrupoMenu | { secao: string };

/** Nome curto de cada POP no menu (ordem da IN MAPA 04/2007, a mesma do Manual de BPF). */
export const NOME_CURTO_POP: Record<number, string> = {
  1: "Fornecedores, MP e embalagens",
  2: "Limpeza e higienização",
  3: "Higiene e saúde do pessoal",
  4: "Potabilidade da água",
  5: "Contaminação cruzada",
  6: "Manutenção e calibração",
  7: "Controle de pragas",
  8: "Resíduos e efluentes",
  9: "Rastreabilidade e recall",
};

/** Telas operacionais e de cadastro que ficam dentro de cada POP, antes dos RQs. */
const TELAS_POR_POP: Record<number, LinkMenu[]> = {
  1: [
    { href: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
    { href: "/materias-primas", rotulo: "Matérias-primas", icone: "saco" },
    { href: "/recebimento", rotulo: `Recebimento (${CODIGO_RQ_RECEBIMENTO})`, icone: "caminhao" },
  ],
  5: [{ href: "/produtos", rotulo: "Produtos e fórmulas", icone: "formula" }],
  9: [
    { href: "/producao", rotulo: "Produção", icone: "fabrica" },
    { href: "/expedicao", rotulo: "Expedição", icone: "saida" },
    { href: "/rastreabilidade", rotulo: "Rastreabilidade", icone: "rastreio" },
    { href: "/recall", rotulo: "Recall e simulados", icone: "alerta" },
  ],
};

export type ModeloMenu = { id: string; codigoRq: string; titulo: string; popNumero: number };

/**
 * Monta o bloco "Auto controles": um grupo por POP (01 a 09) com as telas movidas para ele e os RQs vigentes.
 * Quem registra abre o formulário do RQ; os demais perfis abrem o histórico daquele RQ.
 */
export function gruposAutoControles(
  modelos: ModeloMenu[],
  opcoes: { podeRegistrar: boolean; atrasadasPorRq?: Map<string, number> },
): GrupoMenu[] {
  const atrasadas = opcoes.atrasadasPorRq ?? new Map<string, number>();
  const pops = [...new Set([...Object.keys(NOME_CURTO_POP).map(Number), ...modelos.map((m) => m.popNumero)])].sort((a, b) => a - b);
  return pops.map((n) => {
    const rqs = modelos
      .filter((m) => m.popNumero === n && m.codigoRq !== CODIGO_RQ_RECEBIMENTO)
      .sort((a, b) => a.codigoRq.localeCompare(b.codigoRq, "pt-BR", { numeric: true }))
      .map<LinkMenu>((m) => ({
        href: opcoes.podeRegistrar ? `/rqs/novo?modelo=${m.id}` : `/rqs?rq=${encodeURIComponent(m.codigoRq)}`,
        rotulo: `${m.codigoRq} · ${m.titulo}`,
        icone: "pop",
        contador: atrasadas.get(m.codigoRq) || undefined,
      }));
    const telas = (TELAS_POR_POP[n] ?? []).map((t) =>
      t.href === "/recebimento" ? { ...t, contador: atrasadas.get(CODIGO_RQ_RECEBIMENTO) || undefined } : t,
    );
    const filhos = [...telas, ...rqs, { href: `/rqs?pop=${n}`, rotulo: "Histórico do POP", icone: "livro" }];
    const total = filhos.reduce((s, f) => s + (f.contador ?? 0), 0);
    const pop = String(n).padStart(2, "0");
    return { grupo: `pop-${pop}`, rotulo: `POP ${pop}`, subtitulo: NOME_CURTO_POP[n], icone: "pop", contador: total || undefined, filhos };
  });
}

/** O link está ativo para o caminho e a query atuais? Links com query só valem se a query bater. */
export function linkAtivo(href: string, path: string, query: URLSearchParams): boolean {
  const [base, qs] = href.split("?");
  if (base === "/") return path === "/";
  if (!qs) return path === base || path.startsWith(`${base}/`);
  if (path !== base) return false;
  const esperado = new URLSearchParams(qs);
  return [...esperado].every(([k, v]) => query.get(k) === v);
}
