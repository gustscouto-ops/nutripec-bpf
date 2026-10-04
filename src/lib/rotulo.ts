/**
 * Rótulo regulatório de produto para alimentação animal e etiqueta térmica em ZPL (Zebra).
 * Módulo puro: a mesma estrutura alimenta a prévia na tela e o arquivo .zpl.
 *
 * Itens conferidos tomam como base os elementos de rotulagem exigidos pelo MAPA para produtos destinados
 * à alimentação animal (identificação do produto e do estabelecimento, níveis de garantia, composição,
 * uso, conteúdo, lote, fabricação, validade e conservação). A validação final do texto é do RT.
 */

export type NivelRotulo = { nutriente: string; valor: number | string; unidade: string; tipo?: "min" | "max" };

export type DadosRotulo = {
  empresa: { razaoSocial: string; cnpj: string; registroMapa: string | null; endereco: string | null; cidadeUf: string | null };
  produto: {
    codigo: string;
    nome: string;
    categoria: string | null;
    especieDestino: string | null;
    registroProduto: string | null;
    pesoSacariaKg: number;
    niveisGarantia: NivelRotulo[];
    composicaoBasica: string | null;
    ingredientes: string[]; // em ordem decrescente de inclusão, usados quando não há composição básica escrita
    substitutivos: string | null;
    indicacaoUso: string | null;
    modoUso: string | null;
    restricoes: string | null;
    conservacao: string | null;
    validadeDias: number | null;
    versaoFormula: number;
  };
  lote?: { codigo: string; fabricacao: Date; validade: Date | null } | null;
};

export type Bloco = { titulo?: string; linhas: string[] };

export const TAMANHOS = {
  "100x150": { larguraMm: 100, alturaMm: 150, rotulo: "100 × 150 mm (sacaria)" },
  "100x100": { larguraMm: 100, alturaMm: 100, rotulo: "100 × 100 mm" },
  "100x200": { larguraMm: 100, alturaMm: 200, rotulo: "100 × 200 mm" },
} as const;
export type Tamanho = keyof typeof TAMANHOS;

const TZ = "America/Sao_Paulo";
const data = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: TZ });
const numeroBr = (v: number | string) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : v);

export function validadeDoLote(fabricacao: Date, validadeDias: number | null, validadeInformada?: Date | null) {
  if (validadeInformada) return validadeInformada;
  return validadeDias ? new Date(fabricacao.getTime() + validadeDias * 86_400_000) : null;
}

export function composicao(d: DadosRotulo) {
  return d.produto.composicaoBasica?.trim() || d.produto.ingredientes.join(", ");
}

/** Itens obrigatórios ausentes. Lista vazia = rótulo completo. */
export function pendenciasRotulo(d: DadosRotulo, opcoes: { exigirLote?: boolean } = {}): string[] {
  const p = d.produto;
  const falta: string[] = [];
  if (!p.categoria?.trim()) falta.push("Classificação do produto (ração, concentrado, núcleo, suplemento…)");
  if (!p.especieDestino?.trim()) falta.push("Espécie e fase de destino");
  if (!p.registroProduto?.trim()) falta.push('Nº de registro do produto no MAPA (ou "isento de registro")');
  if (!d.empresa.registroMapa?.trim()) falta.push("Nº de registro do estabelecimento no MAPA (Configurações)");
  if (!d.empresa.endereco?.trim() || !d.empresa.cidadeUf?.trim()) falta.push("Endereço completo do estabelecimento (Configurações)");
  if (!p.niveisGarantia.length) falta.push("Níveis de garantia");
  if (!composicao(d)) falta.push("Composição básica");
  if (!p.indicacaoUso?.trim()) falta.push("Indicação de uso");
  if (!p.modoUso?.trim()) falta.push("Modo de uso");
  if (!p.conservacao?.trim()) falta.push("Condições de conservação");
  if (!p.validadeDias && !d.lote?.validade) falta.push("Prazo de validade");
  if (!(p.pesoSacariaKg > 0)) falta.push("Conteúdo líquido (peso da embalagem)");
  if (opcoes.exigirLote && !d.lote) falta.push("Lote e data de fabricação");
  return falta;
}

/** Texto do rótulo em blocos, na ordem impressa. */
export function blocosRotulo(d: DadosRotulo): Bloco[] {
  const p = d.produto;
  // o sufixo (mín.)/(máx.) só entra quando o nome do nutriente ainda não o traz
  const sufixo = (n: NivelRotulo) => (!n.tipo || /m[íi]n|m[áa]x/i.test(n.nutriente) ? "" : ` (${n.tipo === "min" ? "mín." : "máx."})`);
  const garantias = p.niveisGarantia.map((n) => `${n.nutriente}${sufixo(n)}: ${numeroBr(n.valor)} ${n.unidade}`);
  const blocos: Bloco[] = [
    { titulo: "NÍVEIS DE GARANTIA (por kg do produto)", linhas: garantias },
    { titulo: "COMPOSIÇÃO BÁSICA", linhas: [composicao(d)] },
  ];
  if (p.substitutivos?.trim()) blocos.push({ titulo: "EVENTUAIS SUBSTITUTIVOS", linhas: [p.substitutivos.trim()] });
  if (p.indicacaoUso?.trim()) blocos.push({ titulo: "INDICAÇÃO DE USO", linhas: [p.indicacaoUso.trim()] });
  if (p.modoUso?.trim()) blocos.push({ titulo: "MODO DE USO", linhas: [p.modoUso.trim()] });
  if (p.restricoes?.trim()) blocos.push({ titulo: "RESTRIÇÕES DE USO / PERÍODO DE CARÊNCIA", linhas: [p.restricoes.trim()] });
  if (p.conservacao?.trim()) blocos.push({ titulo: "CONSERVAÇÃO", linhas: [p.conservacao.trim()] });
  return blocos;
}

export function linhasIdentificacao(d: DadosRotulo) {
  const e = d.empresa;
  return [
    `Fabricado por: ${e.razaoSocial} · CNPJ ${e.cnpj}`,
    [e.endereco, e.cidadeUf].filter(Boolean).join(" · "),
    `Registro do estabelecimento no MAPA: ${e.registroMapa ?? "—"} · Registro do produto: ${d.produto.registroProduto ?? "—"}`,
  ].filter(Boolean);
}

export function linhasLote(d: DadosRotulo) {
  if (!d.lote) return { lote: "LOTE: ______________", fabricacao: "FABRICAÇÃO: ___/___/_____", validade: d.produto.validadeDias ? `VALIDADE: ${d.produto.validadeDias} dias após a fabricação` : "VALIDADE: ___/___/_____" };
  const validade = validadeDoLote(d.lote.fabricacao, d.produto.validadeDias, d.lote.validade);
  return { lote: `LOTE: ${d.lote.codigo}`, fabricacao: `FABRICAÇÃO: ${data(d.lote.fabricacao)}`, validade: `VALIDADE: ${validade ? data(validade) : "—"}` };
}

// ───────────────────────────── ZPL ─────────────────────────────

/** Remove os caracteres de comando do ZPL (^ e ~) e quebras de linha do texto do campo. */
export function textoZpl(t: string) {
  return t.replace(/[\^~]/g, "-").replace(/\s*\n\s*/g, " ").trim();
}

type Fonte = { altura: number; largura: number };

/** Estimativa de linhas para a fonte 0 escalável (largura média ~0,55 da altura em caracteres comuns). */
function linhasEstimadas(texto: string, larguraDots: number, f: Fonte) {
  const porLinha = Math.max(1, Math.floor(larguraDots / (f.largura * 0.62)));
  return texto.split(" ").reduce(
    (acc, palavra) => {
      const tam = acc.atual ? acc.atual + 1 + palavra.length : palavra.length;
      if (tam > porLinha && acc.atual) return { linhas: acc.linhas + 1, atual: palavra.length };
      return { linhas: acc.linhas, atual: tam };
    },
    { linhas: 1, atual: 0 },
  ).linhas;
}

export type OpcoesZpl = { tamanho?: Tamanho; dpi?: 203 | 300; copias?: number };

/**
 * Gera a etiqueta em ZPL II (UTF-8, ^CI28). Reduz a fonte do corpo até caber na altura da etiqueta;
 * `cabe` = false indica que nem a menor fonte coube (use etiqueta maior ou encurte o texto).
 */
export function gerarZpl(d: DadosRotulo, opcoes: OpcoesZpl = {}) {
  const tam = TAMANHOS[opcoes.tamanho ?? "100x150"];
  const dpmm = (opcoes.dpi ?? 203) === 300 ? 12 : 8;
  const W = tam.larguraMm * dpmm;
  const H = tam.alturaMm * dpmm;
  const m = 3 * dpmm; // margem de 3 mm
  const util = W - 2 * m;
  const escala = dpmm / 8;
  const copias = Math.max(1, Math.min(9999, Math.round(opcoes.copias ?? 1)));
  const lote = linhasLote(d);
  const blocos = blocosRotulo(d);
  const ident = linhasIdentificacao(d);

  const montar = (corpo: Fonte) => {
    const cmds: string[] = [];
    let y = m;
    const campo = (texto: string, f: Fonte, opc: { negrito?: boolean; centro?: boolean; maxLinhas?: number } = {}) => {
      const t = textoZpl(texto);
      if (!t) return;
      const n = Math.min(opc.maxLinhas ?? 30, linhasEstimadas(t, util, f));
      cmds.push(`^FO${m},${y}^A0N,${f.altura},${f.largura}^FB${util},${n},2,${opc.centro ? "C" : "L"},0^FD${t}^FS`);
      if (opc.negrito) cmds.push(`^FO${m + 1},${y}^A0N,${f.altura},${f.largura}^FB${util},${n},2,${opc.centro ? "C" : "L"},0^FD${t}^FS`);
      y += n * (f.altura + 2) + Math.round(4 * escala);
    };
    const titulo: Fonte = { altura: Math.round(44 * escala), largura: Math.round(40 * escala) };
    const sub: Fonte = { altura: Math.round(22 * escala), largura: Math.round(20 * escala) };
    const secaoF: Fonte = { altura: corpo.altura + Math.round(2 * escala), largura: corpo.largura + Math.round(2 * escala) };

    campo(d.produto.nome.toUpperCase(), titulo, { negrito: true, centro: true, maxLinhas: 3 });
    campo([d.produto.categoria, d.produto.especieDestino].filter(Boolean).join(" · "), sub, { centro: true, maxLinhas: 2 });
    cmds.push(`^FO${m},${y}^GB${util},2,2^FS`);
    y += Math.round(8 * escala);
    for (const b of blocos) {
      if (b.titulo) campo(b.titulo, secaoF, { negrito: true });
      for (const l of b.linhas) campo(l, corpo);
    }
    cmds.push(`^FO${m},${y}^GB${util},2,2^FS`);
    y += Math.round(8 * escala);
    for (const l of ident) campo(l, { altura: corpo.altura - Math.round(2 * escala), largura: corpo.largura - Math.round(2 * escala) });
    // rodapé: peso líquido em destaque, lote/datas e código de barras do lote
    const pesoF: Fonte = { altura: Math.round(40 * escala), largura: Math.round(36 * escala) };
    campo(`PESO LÍQUIDO: ${numeroBr(d.produto.pesoSacariaKg)} kg`, pesoF, { negrito: true });
    campo(`${lote.lote}   ${lote.fabricacao}`, sub, { negrito: true });
    campo(lote.validade, sub, { negrito: true });
    if (d.lote) {
      const alturaBarra = Math.round(70 * escala);
      cmds.push(`^FO${m},${y}^BY${Math.max(2, Math.round(2 * escala))}^BCN,${alturaBarra},Y,N,N^FD${textoZpl(d.lote.codigo)}^FS`);
      y += alturaBarra + Math.round(30 * escala);
    }
    return { cmds, y };
  };

  let fonte: Fonte = { altura: Math.round(22 * escala), largura: Math.round(20 * escala) };
  let r = montar(fonte);
  while (r.y > H - m && fonte.altura > Math.round(14 * escala)) {
    fonte = { altura: fonte.altura - Math.round(2 * escala), largura: fonte.largura - Math.round(2 * escala) };
    r = montar(fonte);
  }
  const zpl = [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    `^FX ${textoZpl(`${d.produto.codigo} v${d.produto.versaoFormula}${d.lote ? ` lote ${d.lote.codigo}` : " modelo"}`)} - gerado pelo NutriPEC BPF`,
    ...r.cmds,
    `^PQ${copias},0,1,Y`,
    "^XZ",
  ].join("\n");
  return { zpl: zpl + "\n", cabe: r.y <= H - m, fonteCorpo: fonte.altura, larguraDots: W, alturaDots: H };
}
