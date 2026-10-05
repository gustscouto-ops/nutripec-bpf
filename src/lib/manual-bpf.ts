/**
 * Manual de Boas Práticas de Fabricação (MB01 + POP 01 a 09 + registros) gerado a partir do modelo ODT
 * enviado pela consultoria. O layout (cabeçalho, rodapé, tabelas, imagens) é o do arquivo original; o sistema
 * troca apenas os dados da fábrica, os responsáveis, a data de emissão e a revisão.
 *
 * Módulo puro (sem banco nem LibreOffice) para poder ser testado isoladamente.
 */

export type DadosManual = {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  atividade: string;
  cabecalhoLinha1: string; // "logo" em texto dos registros (ex.: AGROLESTE)
  cabecalhoLinha2: string; // segunda linha do logo (ex.: Nutrição Animal)
  rtNome: string;
  rtRegistro: string; // ex.: CRMV/MG – 1627/Z
  responsavelLegal: string;
  responsavelFabrica: string;
  controleQualidade: string;
  dataEmissao: string; // AAAA-MM-DD
  revisao: string; // ex.: 02
};

export const CAMPOS_OBRIGATORIOS: (keyof DadosManual)[] = [
  "razaoSocial",
  "cnpj",
  "logradouro",
  "cidade",
  "uf",
  "cabecalhoLinha1",
  "rtNome",
  "rtRegistro",
  "responsavelLegal",
  "dataEmissao",
  "revisao",
];

export const ESTADOS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** Textos do modelo original que identificam a Agro Leste e são trocados pelos dados de cada fábrica. */
export const ORIGINAIS = {
  razaoSocial: ["AGRO LESTE NUTRICAO ANIMAL LTDA", "AGRO LESTE NUTRIÇÃO ANIMAL LTDA", "Agro Leste Nutrição Animal Ltda"],
  cabecalhoLinha1: "AGROLESTE",
  cabecalhoLinha2: "Nutrição Animal",
  enderecoRodape: "ROD LMG 766 KM 04, S/N - Zona Rural, Itanhomi - MG, Cep: 35.120-000",
  localizacaoTexto: "na Rodovia LMG 766, km 04, zona rural de Itanhomi – MG",
  logradouro: "ROD LMG 766 KM 04, S/N",
  bairro: "Bairro: Zona Rural",
  cidade: "Cidade: Itanhomi - MG",
  cep: "Cep: 35.120-000",
  telefone: "(33)99900-7188",
  email: "agrolesteita@gmail.com",
  cnpj: "55.471.362/0001-52",
  inscricaoEstadual: "004913581.00-17",
  atividade: "Fabricação de Ração Balanceada, Concentrado e Suplemento Mineral Proteico.",
  localCapa: "ITANHOMI-MINAS GERAIS",
  anoCapa: "ANO 2026",
  data: "15/01/2026",
  revisao: ["Revisão: 02", "REVISÃO: 02"],
  rtNome: "Gustavo Souza Couto",
  rtRegistro: ["CRMV/MG – 1627/Z", "CRMV – MG 1627/Z"],
  responsavelLegal: ["Roziely Joice Freitas Mariano", "Gilberto Geraldo Pimenta"],
  responsavelFabrica: "Adeilson Vieira Coelho",
  controleQualidade: "Gabrielle Abadia Silva Ramos",
  produtoExemplo: "Ração Agroleste Leite 22",
} as const;

const escaparXml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Marcas de formatação que podem quebrar um texto em pedaços (spans, marcadores, espaços codificados).
// Fim/início de parágrafo, título e tabela não entram: a busca nunca atravessa parágrafos.
const MARCA = "(?:<(?!/?(?:text:p|text:h|table:|draw:|style:)\\b)[^>]*>)";

/**
 * Regex que encontra o texto mesmo quando o Writer o dividiu em vários <text:span> (ex.: "15/<span>01</span>/2026")
 * ou codificou espaços como <text:s/>.
 */
export function regexTexto(texto: string) {
  const unidades = escaparXml(texto).match(/&[a-z]+;|[\s\S]/g) ?? [];
  const partes = unidades.map((u) => (u === " " ? "(?: |<text:s(?: [^>]*)?/>)" : escaparRegex(u)));
  return new RegExp(partes.join(`${MARCA}*`), "g");
}

/**
 * Troca todas as ocorrências de `de` por `para` no XML, preservando as marcas internas (para o XML continuar
 * balanceado) e aplicando o novo texto com a formatação do primeiro pedaço.
 */
export function substituir(xml: string, de: string, para: string): { xml: string; trocas: number } {
  let trocas = 0;
  const novo = xml.replace(regexTexto(de), (casado) => {
    trocas++;
    const marcas = casado.match(/<[^>]*>/g) ?? [];
    return escaparXml(para) + marcas.join("");
  });
  return { xml: novo, trocas };
}

export function fmtDataBr(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Pares (texto original → texto da fábrica), na ordem de aplicação: frases longas antes das partes. */
export function paresSubstituicao(d: DadosManual): [string, string][] {
  const o = ORIGINAIS;
  const cidadeUf = `${d.cidade} - ${d.uf}`;
  const enderecoCompleto = [d.logradouro, d.bairro].filter(Boolean).join(" - ") + `, ${cidadeUf}` + (d.cep ? `, Cep: ${d.cep}` : "");
  const estado = ESTADOS[d.uf.toUpperCase()] ?? d.uf;
  const pares: [string, string][] = [
    [o.enderecoRodape, enderecoCompleto],
    [o.localizacaoTexto, `em ${[d.logradouro, d.bairro].filter(Boolean).join(", ")}, ${d.cidade} – ${d.uf}`],
    ...o.razaoSocial.map((r): [string, string] => [r, r === r.toUpperCase() ? d.razaoSocial.toUpperCase() : d.razaoSocial]),
    [o.logradouro, d.logradouro],
    [o.bairro, `Bairro: ${d.bairro || "—"}`],
    [o.cidade, `Cidade: ${cidadeUf}`],
    [o.cep, `Cep: ${d.cep || "—"}`],
    [o.telefone, d.telefone || "—"],
    [o.email, d.email || "—"],
    [o.cnpj, d.cnpj],
    [o.inscricaoEstadual, d.inscricaoEstadual || "isento"],
    [o.atividade, d.atividade],
    [o.localCapa, `${d.cidade}-${estado}`.toUpperCase()],
    [o.anoCapa, `ANO ${d.dataEmissao.slice(0, 4)}`],
    [o.data, fmtDataBr(d.dataEmissao)],
    ...o.revisao.map((r): [string, string] => [r, r.replace("02", d.revisao)]),
    ...o.rtRegistro.map((r): [string, string] => [r, d.rtRegistro]),
    [o.rtNome, d.rtNome],
    ...o.responsavelLegal.map((r): [string, string] => [r, d.responsavelLegal]),
    [o.responsavelFabrica, d.responsavelFabrica || d.responsavelLegal],
    [o.controleQualidade, d.controleQualidade || d.rtNome],
    [o.produtoExemplo, "Ração Leite 22"], // exemplo de codificação de lote no POP 09
  ];
  return pares;
}

/** Aplica os dados da fábrica a um XML do modelo (content.xml ou styles.xml). */
export function personalizarXml(xml: string, d: DadosManual) {
  const contagem: Record<string, number> = {};
  let atual = xml;
  for (const [de, para] of paresSubstituicao(d)) {
    const r = substituir(atual, de, para);
    atual = r.xml;
    contagem[de] = (contagem[de] ?? 0) + r.trocas;
  }
  // o logo em texto dos registros fica num <text:span> só com ele: troca literal (são palavras comuns)
  for (const [de, para] of [
    [ORIGINAIS.cabecalhoLinha1, d.cabecalhoLinha1],
    [ORIGINAIS.cabecalhoLinha2, d.cabecalhoLinha2],
  ]) {
    const partes = atual.split(`>${de}<`);
    contagem[de] = partes.length - 1;
    atual = partes.join(`>${escaparXml(para)}<`);
  }
  return { xml: atual, contagem };
}

/** Textos da Agro Leste que não podem sobrar no manual de outra fábrica (usado em teste e na conferência). */
export const VESTIGIOS = [
  "AGRO LESTE",
  "Agro Leste",
  "Agroleste",
  "Gustavo Souza Couto",
  "Roziely",
  "Adeilson",
  "Gabrielle",
  "Gilberto",
  "55.471.362",
  "004913581",
  "LMG 766",
  "agrolesteita",
  "99900-7188",
  "1627/Z",
  "15/01/2026",
];

export function validarDados(d: DadosManual) {
  const campos: Record<string, string> = {};
  for (const c of CAMPOS_OBRIGATORIOS) if (!String(d[c] ?? "").trim()) campos[c] = "Obrigatório";
  if (d.dataEmissao && !/^\d{4}-\d{2}-\d{2}$/.test(d.dataEmissao)) campos.dataEmissao = "Data inválida";
  if (d.uf && !ESTADOS[d.uf.toUpperCase()]) campos.uf = "UF inválida";
  if (d.revisao && !/^\d{1,3}$/.test(d.revisao)) campos.revisao = "Use só números (ex.: 03)";
  return campos;
}
