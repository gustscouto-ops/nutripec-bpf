import PDFDocument from "pdfkit";
import type { Frequencia } from "@prisma/client";
import { ROTULO_PERFIL } from "../permissions";
import { padraoDoCampo, type CampoRq, type Respostas } from "../rq/campos";
import { ROTULO_FREQUENCIA } from "../rq/catalogo";
import type { Identidade } from "../servicos/identidade";
import { fmtData, fmtDataHora, paraBuffer } from "./base";

/**
 * Folha dos registros da qualidade no padrão dos formulários da fábrica:
 * cabeçalho com logo, nome da empresa, código (RQ/POP), revisão, data da revisão e título do RQ;
 * rodapé com quem elabora e verifica (RT), monitora (controle de qualidade) e aprova (proprietário).
 * Serve ao formulário em branco (anexo do POP) e ao registro preenchido e assinado.
 */

export const LARG_PAGINA = 595.28;
const M = 36; // margem lateral
const TOPO = 26;
const ALT_CAB = 74;
const ALT_ROD = 42;
const W = LARG_PAGINA - 2 * M;
const PRETO = "#111827";
const CINZA = "#6b7280";
const FUNDO = "#e5e7eb";
const VERMELHO = "#b91c1c";
const VERDE = "#15803d";

export type Doc = PDFKit.PDFDocument;

export type InfoCabecalho = {
  codigo: string; // "RQ 6.3 / POP 06"
  revisao: number;
  dataRevisao: Date | null;
  titulo: string;
  rodape: string; // texto pequeno abaixo do quadro de responsáveis
};

/** Helvetica/Times padrão do PDF só têm o conjunto WinAnsi: troca o que não cabe nele. */
const TROCAS: Record<string, string> = { "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "−": "-", "✓": "OK", "×": "x" };
const WIN_ANSI_EXTRA = new Set("–—‘’‚“”„•…€™ŒœŠšŸŽžƒˆ˜‰‹›†‡");
export function t(texto: string | number | null | undefined): string {
  return Array.from(String(texto ?? ""))
    .map((c) => TROCAS[c] ?? (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c) ? c : "?"))
    .join("");
}

export const rev = (n: number) => String(n).padStart(2, "0");

export function novoFormulario(titulo: string): Doc {
  return new PDFDocument({
    size: "A4",
    margins: { top: TOPO + ALT_CAB + 14, bottom: ALT_ROD + 40, left: M, right: M },
    bufferPages: true,
    info: { Title: t(titulo), Creator: "NutriPEC Gestão BPF" },
  });
}

const limite = (doc: Doc) => doc.page.height - doc.page.margins.bottom;

export function espaco(doc: Doc, altura: number) {
  if (doc.y + altura > limite(doc)) doc.addPage();
}

// ───────────────────────── Cabeçalho e rodapé ─────────────────────────

function desenharCabecalho(doc: Doc, ident: Identidade, info: InfoCabecalho) {
  const x = M;
  const y = TOPO;
  const logoW = 104;
  const l1 = 32;
  const l2 = 20;
  const l3 = ALT_CAB - l1 - l2;
  doc.save().lineWidth(0.8).strokeColor(PRETO);
  doc.rect(x, y, W, ALT_CAB).stroke();
  doc.moveTo(x + logoW, y).lineTo(x + logoW, y + l1 + l2).stroke();
  doc.moveTo(x + logoW, y + l1).lineTo(x + W, y + l1).stroke();
  doc.moveTo(x, y + l1 + l2).lineTo(x + W, y + l1 + l2).stroke();
  const resto = W - logoW;
  const c1 = resto * 0.42;
  const c2 = resto * 0.24;
  doc.moveTo(x + logoW + c1, y + l1).lineTo(x + logoW + c1, y + l1 + l2).stroke();
  doc.moveTo(x + logoW + c1 + c2, y + l1).lineTo(x + logoW + c1 + c2, y + l1 + l2).stroke();
  doc.restore();

  if (ident.logo) {
    try {
      doc.image(ident.logo.conteudo, x + 4, y + 3, { fit: [logoW - 8, l1 + l2 - 6], align: "center", valign: "center" });
    } catch {
      /* imagem inválida: cabeçalho sem logo */
    }
  }
  doc.fillColor(PRETO).font("Times-Bold");
  let tam = 17;
  doc.fontSize(tam);
  while (tam > 10 && doc.widthOfString(t(ident.nomeCabecalho)) > resto - 12) doc.fontSize(--tam);
  doc.text(t(ident.nomeCabecalho), x + logoW + 6, y + (l1 - tam) / 2 + 1, { width: resto - 12, align: "center", lineBreak: false });
  doc.font("Times-Bold").fontSize(9);
  const yl2 = y + l1 + (l2 - 9) / 2 + 1;
  doc.text(t(`Código: ${info.codigo}`), x + logoW, yl2, { width: c1, align: "center", lineBreak: false });
  doc.text(`Revisão: ${rev(info.revisao)}`, x + logoW + c1, yl2, { width: c2, align: "center", lineBreak: false });
  doc.text(`Data: ${info.dataRevisao ? fmtData(info.dataRevisao) : "___/___/______"}`, x + logoW + c1 + c2, yl2, { width: resto - c1 - c2, align: "center", lineBreak: false });
  doc.fontSize(10);
  let titulo = t(info.titulo);
  while (doc.widthOfString(titulo) > W - 12 && titulo.length > 10) titulo = `${titulo.slice(0, -2).trimEnd()}…`;
  doc.text(titulo, x + 6, y + l1 + l2 + (l3 - 10) / 2 + 1, { width: W - 12, align: "center", lineBreak: false });
}

function desenharRodape(doc: Doc, ident: Identidade, info: InfoCabecalho, pagina: number, total: number) {
  const y = doc.page.height - 30 - ALT_ROD;
  const larg = W * 0.86;
  const x = M + (W - larg) / 2;
  const col = larg / 3;
  doc.save().lineWidth(0.8).strokeColor(PRETO).rect(x, y, larg, ALT_ROD).stroke();
  doc.moveTo(x + col, y).lineTo(x + col, y + ALT_ROD).stroke();
  doc.moveTo(x + 2 * col, y).lineTo(x + 2 * col, y + ALT_ROD).stroke();
  doc.restore();
  const blocos: [string, string, string][] = [
    ["Elaborado e Verificado por:", ident.rtNome, `(Responsável Técnico${ident.rtRegistro ? ` - ${ident.rtRegistro}` : ""})`],
    ["Monitorado por:", ident.controleQualidade, "(Controle de Qualidade)"],
    ["Aprovado por:", ident.proprietario, "(Proprietário)"],
  ];
  // cada linha encolhe a fonte até caber na coluna (nomes e registros longos não quebram o quadro)
  const linha = (texto: string, cx: number, yy: number, tamanho: number) => {
    let tam = tamanho;
    doc.font("Helvetica").fontSize(tam);
    while (tam > 5.5 && doc.widthOfString(texto) > col - 8) doc.fontSize((tam -= 0.5));
    doc.text(texto, cx, yy, { width: col - 8, align: "center", lineBreak: false });
  };
  blocos.forEach(([r, nome, papel], i) => {
    const cx = x + i * col + 4;
    doc.fillColor(PRETO);
    linha(r, cx, y + 5, 8);
    linha(t(nome || "______________________"), cx, y + 16, 8);
    linha(t(papel), cx, y + 28, 7.5);
  });
  doc.fillColor(CINZA).font("Helvetica").fontSize(6.5);
  doc.text(t(info.rodape), M, y + ALT_ROD + 6, { width: W * 0.8, lineBreak: false });
  doc.text(`Página ${pagina} de ${total}`, M + W * 0.8, y + ALT_ROD + 6, { width: W * 0.2, align: "right", lineBreak: false });
}

/** Desenha cabeçalho e rodapé em todas as páginas. Cada trecho de páginas pode ser de um RQ diferente. */
export function emoldurar(doc: Doc, ident: Identidade, trechos: { inicio: number; info: InfoCabecalho }[]) {
  const total = doc.bufferedPageRange().count;
  trechos.forEach((tr, i) => {
    const fim = i + 1 < trechos.length ? trechos[i + 1].inicio : total;
    for (let p = tr.inicio; p < fim; p++) {
      doc.switchToPage(p);
      const margens = { ...doc.page.margins };
      doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
      desenharCabecalho(doc, ident, tr.info);
      desenharRodape(doc, ident, tr.info, p - tr.inicio + 1, fim - tr.inicio);
      doc.page.margins = margens;
    }
  });
}

// ───────────────────────── Tabela com bordas ─────────────────────────

type Alinhar = "left" | "center" | "right";
export type Celula =
  | string
  | { texto: string; negrito?: boolean; cor?: string; alinhar?: Alinhar }
  | { caixas: string[] }
  | { linha: string };
export type ColunaGrade = { titulo: string; peso: number; alinhar?: Alinhar };

const PAD = 3;

function alturaCelula(doc: Doc, c: Celula, largura: number, fonte: number) {
  if (typeof c === "object" && ("caixas" in c || "linha" in c)) return fonte + 4;
  const texto = typeof c === "string" ? c : c.texto;
  doc.font(typeof c === "object" && c.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(fonte);
  return doc.heightOfString(t(texto) || " ", { width: largura - 2 * PAD });
}

function desenharCelula(doc: Doc, c: Celula, x: number, y: number, largura: number, altura: number, fonte: number, alinhar: Alinhar) {
  if (typeof c === "object" && "caixas" in c) {
    doc.font("Helvetica").fontSize(fonte).fillColor(PRETO);
    const lados = 7;
    const larguras = c.caixas.map((r) => lados + 3 + doc.widthOfString(r) + 6);
    let cx = x + (largura - larguras.reduce((s, l) => s + l, 0)) / 2;
    const cy = y + (altura - lados) / 2;
    c.caixas.forEach((r, i) => {
      doc.save().lineWidth(0.6).strokeColor(PRETO).rect(cx, cy, lados, lados).stroke().restore();
      doc.text(r, cx + lados + 3, cy - 0.5, { lineBreak: false });
      cx += larguras[i];
    });
    return;
  }
  if (typeof c === "object" && "linha" in c) {
    const yy = y + altura - 5;
    doc.save().lineWidth(0.5).strokeColor(CINZA).moveTo(x + 8, yy).lineTo(x + largura - 8 - (c.linha ? doc.widthOfString(c.linha) + 4 : 0), yy).stroke().restore();
    if (c.linha) doc.font("Helvetica").fontSize(fonte).fillColor(PRETO).text(t(c.linha), x + largura - 8 - doc.widthOfString(c.linha), yy - fonte, { lineBreak: false });
    return;
  }
  const obj = typeof c === "string" ? { texto: c } : c;
  doc.font(obj.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(fonte).fillColor(obj.cor ?? PRETO);
  const h = doc.heightOfString(t(obj.texto) || " ", { width: largura - 2 * PAD });
  doc.text(t(obj.texto), x + PAD, y + Math.max(PAD - 1, (altura - h) / 2), { width: largura - 2 * PAD, align: obj.alinhar ?? alinhar });
}

/** Tabela com bordas pretas, como nos formulários em papel; repete o cabeçalho ao quebrar a página. */
export function grade(doc: Doc, colunas: ColunaGrade[], linhas: Celula[][], o: { fonte?: number; alturaMin?: number; semCabecalho?: boolean } = {}) {
  const fonte = o.fonte ?? 8;
  const total = colunas.reduce((s, c) => s + c.peso, 0);
  const larguras = colunas.map((c) => (c.peso / total) * W);
  const xs = larguras.map((_, i) => M + larguras.slice(0, i).reduce((s, l) => s + l, 0));
  const borda = (y: number, h: number) => {
    doc.save().lineWidth(0.6).strokeColor(PRETO);
    larguras.forEach((l, i) => doc.rect(xs[i], y, l, h).stroke());
    doc.restore();
  };
  const cabecalho = () => {
    if (o.semCabecalho) return;
    doc.font("Helvetica-Bold").fontSize(fonte);
    const h = Math.max(...colunas.map((c, i) => doc.heightOfString(t(c.titulo), { width: larguras[i] - 2 * PAD }))) + 2 * PAD + 2;
    const y = doc.y;
    doc.save().rect(M, y, W, h).fill(FUNDO).restore();
    borda(y, h);
    colunas.forEach((c, i) => desenharCelula(doc, { texto: c.titulo, negrito: true, alinhar: "center" }, xs[i], y, larguras[i], h, fonte, "center"));
    doc.y = y + h;
  };
  espaco(doc, 40);
  cabecalho();
  for (const linha of linhas) {
    const h = Math.max(o.alturaMin ?? 0, ...linha.map((c, i) => alturaCelula(doc, c, larguras[i], fonte) + 2 * PAD));
    if (doc.y + h > limite(doc)) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    borda(y, h);
    linha.forEach((c, i) => desenharCelula(doc, c, xs[i], y, larguras[i], h, fonte, colunas[i].alinhar ?? "left"));
    doc.y = y + h;
  }
  doc.x = M;
}

// ───────────────────────── Pedaços comuns ─────────────────────────

export function linhaInfo(doc: Doc, partes: [string, string][]) {
  espaco(doc, 16);
  const y = doc.y;
  doc.fillColor(PRETO).fontSize(8.5);
  let x = M;
  for (const [r, v] of partes) {
    doc.font("Times-Bold").text(t(`${r}: `), x, y, { continued: true, lineBreak: false }).font("Times-Roman").text(t(v), { lineBreak: false });
    x = doc.x + 18;
    doc.x = x;
  }
  doc.x = M;
  doc.y = y + 13;
}

export function subtitulo(doc: Doc, texto: string) {
  espaco(doc, 50);
  doc.moveDown(0.5);
  doc.fillColor(PRETO).font("Times-Bold").fontSize(10).text(t(texto), M, doc.y, { width: W });
  doc.moveDown(0.25);
}

function linhaParaEscrever(doc: Doc, rotulo: string, larguraRotulo?: number) {
  espaco(doc, 20);
  const y = doc.y + 6;
  doc.fillColor(PRETO).font("Times-Roman").fontSize(9).text(t(rotulo), M, y, { lineBreak: false });
  const x0 = rotulo ? M + (larguraRotulo ?? doc.widthOfString(t(rotulo)) + 4) : M;
  doc.save().lineWidth(0.6).strokeColor(PRETO).moveTo(x0, y + 9).lineTo(M + W, y + 9).stroke().restore();
  doc.y = y + 14;
}

function linhaDupla(doc: Doc, a: string, b: string) {
  espaco(doc, 22);
  const y = doc.y + 8;
  doc.fillColor(PRETO).font("Times-Roman").fontSize(9);
  doc.text(t(a), M, y, { lineBreak: false });
  const xa = M + doc.widthOfString(t(a)) + 4;
  doc.save().lineWidth(0.6).strokeColor(PRETO).moveTo(xa, y + 9).lineTo(M + W * 0.62, y + 9).stroke().restore();
  doc.text(t(b), M + W * 0.66, y, { lineBreak: false });
  doc.text("____/____/______", M + W * 0.66 + doc.widthOfString(t(b)) + 4, y, { lineBreak: false });
  doc.x = M;
  doc.y = y + 16;
}

export const LEGENDA_IN04 =
  "C = Conforme · NC = Não conforme · NA = Não se aplica. Preencher à tinta, sem rasuras, datar e assinar; arquivar em ordem cronológica por no mínimo 2 anos (3 anos para produtos com medicamentos). IN MAPA 04/2007, itens 7.15, 8.2 e 8.3.";

/** Orientações + aviso de não conformidade + campos de monitor/verificador + relatório de NC (IN 04/2007, 7.2). */
export function fechamentoEmBranco(doc: Doc, orientacoes: string | null) {
  espaco(doc, 120);
  doc.moveDown(0.6);
  if (orientacoes) {
    doc.fillColor(PRETO).font("Helvetica-Bold").fontSize(8.5).text(t(`OBS: ${orientacoes}`), M, doc.y, { width: W, align: "center" });
    doc.moveDown(0.4);
  }
  doc.font("Times-Bold").fontSize(9.5).text("QUALQUER ANOTAÇÃO FORA DOS PADRÕES, PREENCHER O RELATÓRIO DE NÃO CONFORMIDADE ABAIXO", M, doc.y, { width: W, align: "center" });
  doc.moveDown(0.3);
  linhaDupla(doc, "Monitorado por:", "Data:");
  linhaDupla(doc, "Verificado por:", "Data:");

  espaco(doc, 250);
  doc.moveDown(0.8);
  doc.font("Times-Bold").fontSize(10).text("RELATÓRIO DE NÃO CONFORMIDADE", M, doc.y, { width: W, align: "center", underline: true });
  doc.moveDown(0.2);
  linhaParaEscrever(doc, "Descrição da não conformidade:");
  linhaParaEscrever(doc, "");
  linhaParaEscrever(doc, "");
  linhaParaEscrever(doc, "Ação corretiva sobre o produto:");
  linhaParaEscrever(doc, "");
  linhaParaEscrever(doc, "Restauração das condições sanitárias:");
  linhaParaEscrever(doc, "");
  linhaParaEscrever(doc, "Medida preventiva:");
  linhaParaEscrever(doc, "");
  linhaDupla(doc, "Responsável pela ação:", "Previsão para atendimento:");
  linhaDupla(doc, "Eficácia verificada por:", "Data do atendimento:");
  doc.moveDown(0.6);
  doc.fillColor(CINZA).font("Helvetica").fontSize(6.5).text(t(LEGENDA_IN04), M, doc.y, { width: W, align: "center" });
}

// ───────────────────────── Formulário em branco ─────────────────────────

const ORDINAL = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª"];
const REGISTROS_PADRAO: Partial<Record<Frequencia, number>> = { SEMANAL: 5, QUINZENAL: 2, QUANDO_OCORRE: 3, PERIODICA: 2 };

export function registrosPorFolha(frequencia: Frequencia, configurado: number | null | undefined) {
  return configurado ?? REGISTROS_PADRAO[frequencia] ?? 1;
}

function rotuloBloco(frequencia: Frequencia, i: number) {
  if (frequencia === "SEMANAL") return `${ORDINAL[i] ?? `${i + 1}ª`} semana`;
  if (frequencia === "QUINZENAL") return `${ORDINAL[i] ?? `${i + 1}ª`} quinzena`;
  if (frequencia === "MENSAL") return "Mês de referência: ______/________";
  if (frequencia === "SEMESTRAL") return "Semestre de referência: ____º/________";
  if (frequencia === "ANUAL") return "Ano de referência: ________";
  return `Registro ${i + 1}`;
}

const resultadoEmBranco = (c: CampoRq): Celula =>
  c.tipo === "conformidade" ? { caixas: ["C", "NC", "NA"] } : c.tipo === "numerico" ? { linha: c.unidade ?? "" } : { linha: "" };

export type ModeloImpressao = {
  codigoRq: string;
  titulo: string;
  frequencia: Frequencia;
  campos: CampoRq[];
  orientacoes: string | null;
  registrosPorFolha: number | null;
  popNumero: number;
  popTitulo: string;
  prazo?: string;
};

const CAMPOS_CARGA = ["Fornecedor", "Nota fiscal", "Matéria-prima", "Peso total (kg)", "Lote do fornecedor", "Lote interno", "Fabricação", "Validade", "Placa do veículo", "Transportadora / motorista"];

function blocoEmBranco(doc: Doc, m: ModeloImpressao, i: number) {
  const alturaBloco = 30 + m.campos.length * 17 + 20;
  espaco(doc, Math.min(alturaBloco, 300));
  doc.moveDown(0.4);
  const y = doc.y;
  doc.fillColor(PRETO).font("Times-Bold").fontSize(9.5).text(t(rotuloBloco(m.frequencia, i)), M, y, { lineBreak: false });
  doc.font("Times-Roman").fontSize(9).text("Data: ____/____/______      Monitor: __________________________________", M + W * 0.42, y, { width: W * 0.58, align: "right", lineBreak: false });
  doc.y = y + 14;
  doc.x = M;
  if (m.codigoRq === "RQ 1.2") {
    const pares: Celula[][] = [];
    for (let k = 0; k < CAMPOS_CARGA.length; k += 2) pares.push([{ texto: CAMPOS_CARGA[k], negrito: true }, "", { texto: CAMPOS_CARGA[k + 1], negrito: true }, ""]);
    grade(doc, [{ titulo: "", peso: 1.1 }, { titulo: "", peso: 1.6 }, { titulo: "", peso: 1.1 }, { titulo: "", peso: 1.6 }], pares, { semCabecalho: true, alturaMin: 17 });
    doc.moveDown(0.3);
  }
  grade(
    doc,
    [
      { titulo: "Nº", peso: 0.35, alinhar: "center" },
      { titulo: "Item verificado", peso: 3.4 },
      { titulo: "Padrão / limite", peso: 1.35, alinhar: "center" },
      { titulo: "Resultado", peso: 1.45, alinhar: "center" },
      { titulo: "Observação", peso: 1.5 },
    ],
    m.campos.map((c, k) => [String(k + 1), c.rotulo, padraoDoCampo(c), resultadoEmBranco(c), ""]),
    { alturaMin: 17 },
  );
}

/** Diária: grade do mês com os itens nas linhas e os dias nas colunas (duas grades: dias 1 a 16 e 17 a 31). */
function gradeMensal(doc: Doc, m: ModeloImpressao) {
  linhaInfo(doc, [["Mês/Ano", "______/________"], ["Anotar", "C, NC ou NA; nas medições, o valor lido"]]);
  for (const [de, ate] of [
    [1, 16],
    [17, 31],
  ]) {
    doc.moveDown(0.4);
    const dias = Array.from({ length: ate - de + 1 }, (_, k) => String(de + k));
    const vazio = dias.map(() => "");
    grade(
      doc,
      [{ titulo: "Item verificado (padrão)", peso: 9 }, ...dias.map((d) => ({ titulo: d, peso: 1, alinhar: "center" as const }))],
      [
        ...m.campos.map((c, k) => [`${k + 1}. ${c.rotulo}${c.tipo === "numerico" ? ` (${padraoDoCampo(c)})` : ""}`, ...vazio]),
        [{ texto: "Monitor (rubrica)", negrito: true }, ...vazio],
        [{ texto: "Verificador (rubrica)", negrito: true }, ...vazio],
      ],
      { fonte: 7, alturaMin: 16 },
    );
  }
}

export function corpoEmBranco(doc: Doc, m: ModeloImpressao) {
  linhaInfo(doc, [
    ["FREQUÊNCIA", `${ROTULO_FREQUENCIA[m.frequencia].toUpperCase()}${m.prazo ? ` (${m.prazo})` : ""}`],
    ["POP", `${String(m.popNumero).padStart(2, "0")} - ${m.popTitulo}`],
  ]);
  if (m.frequencia === "DIARIA") gradeMensal(doc, m);
  else for (let i = 0; i < registrosPorFolha(m.frequencia, m.registrosPorFolha); i++) blocoEmBranco(doc, m, i);
  fechamentoEmBranco(doc, m.orientacoes);
}

// ───────────────────────── Registro preenchido ─────────────────────────

const ROT_RESULTADO: Record<string, string> = { C: "Conforme", NC: "NÃO CONFORME", NA: "N/A" };

export function tabelaRespostas(doc: Doc, campos: CampoRq[], respostas: Respostas) {
  grade(
    doc,
    [
      { titulo: "Nº", peso: 0.35, alinhar: "center" },
      { titulo: "Item verificado", peso: 3.2 },
      { titulo: "Padrão / limite", peso: 1.3, alinhar: "center" },
      { titulo: "Resultado", peso: 1.3, alinhar: "center" },
      { titulo: "Observação / ação corretiva imediata", peso: 2.1 },
    ],
    campos.map((c, i) => {
      const r = respostas[c.id];
      const nc = r?.conforme === false;
      const valor =
        r?.valor === undefined || r.valor === null || r.valor === ""
          ? "—"
          : c.tipo === "conformidade"
            ? (ROT_RESULTADO[String(r.valor)] ?? String(r.valor))
            : c.tipo === "numerico"
              ? `${Number(r.valor).toLocaleString("pt-BR")}${c.unidade ? ` ${c.unidade}` : ""}`
              : String(r.valor);
      return [
        String(i + 1),
        c.rotulo,
        padraoDoCampo(c),
        { texto: valor, negrito: nc, cor: nc ? VERMELHO : PRETO, alinhar: c.tipo === "texto" ? "left" : "center" },
        nc ? { texto: `Ocorrido: ${r.descricaoNc}\nAção imediata: ${r.acaoCorretiva}`, cor: VERMELHO } : "",
      ];
    }),
    { alturaMin: 16 },
  );
}

export type Assinante = { nome: string; perfil: string; registro?: string | null; dataHora: Date; hash: string; ip?: string | null; parecer?: string | null };

/** Quadros de assinatura eletrônica lado a lado: monitor (quem preencheu) e verificador. */
export function assinaturas(doc: Doc, monitor: Assinante, verificador: Assinante | null) {
  espaco(doc, 120);
  doc.moveDown(0.6);
  const y = doc.y;
  const larg = (W - 12) / 2;
  const quadro = (x: number, titulo: string, a: Assinante | null) => {
    doc.save().lineWidth(0.8).strokeColor(a ? VERDE : CINZA).roundedRect(x, y, larg, 104, 4).stroke().restore();
    doc.fillColor(CINZA).font("Helvetica-Bold").fontSize(7.5).text(titulo.toUpperCase(), x + 8, y + 7, { width: larg - 16 });
    if (!a) {
      doc.fillColor(CINZA).font("Helvetica").fontSize(9).text("Aguardando verificação pelo RT", x + 8, y + 22, { width: larg - 16 });
      doc.fontSize(7.5).text("Verificado por: ____________________________   Data: ____/____/______", x + 8, y + 78, { width: larg - 16 });
      return;
    }
    doc.fillColor(PRETO).font("Helvetica-Bold").fontSize(10).text(t(a.nome), x + 8, y + 19, { width: larg - 16 });
    doc.font("Helvetica").fontSize(8).text(t(`${a.perfil}${a.registro ? ` · ${a.registro}` : ""}`), { width: larg - 16 });
    doc.text(t(`${fmtDataHora(a.dataHora)}${a.ip ? ` · IP ${a.ip}` : ""}`), { width: larg - 16 });
    if (a.parecer) doc.text(t(`Parecer: ${a.parecer}`), { width: larg - 16, height: 22, ellipsis: true });
    doc.fillColor(CINZA).fontSize(6.5).text("Assinado eletronicamente com senha pessoal e intransferível. SHA-256:", x + 8, y + 78, { width: larg - 16 });
    doc.font("Courier").fontSize(6).text(a.hash, { width: larg - 16 });
  };
  quadro(M, "Monitorado por (assinatura eletrônica)", monitor);
  quadro(M + larg + 12, "Verificado por (assinatura eletrônica)", verificador);
  doc.x = M;
  doc.y = y + 112;
}

export { paraBuffer, ROTULO_PERFIL, W as LARGURA_UTIL, M as MARGEM_LATERAL, PRETO, CINZA, VERMELHO, VERDE };
