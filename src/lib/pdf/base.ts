import PDFDocument from "pdfkit";
import type { Tenant } from "@prisma/client";

/** Folha timbrada padrão dos registros da qualidade. */

export const COR = { marca: "#136a3d", texto: "#0f172a", suave: "#64748b", linha: "#e2e8f0", vermelho: "#b91c1c", verde: "#15803d" };
export const MARGEM = 40;

export function novoDocumento(titulo: string) {
  return new PDFDocument({ size: "A4", margin: MARGEM, bufferPages: true, info: { Title: titulo, Creator: "NutriPEC Gestão BPF" } });
}

export type Doc = PDFKit.PDFDocument;

export function largura(doc: Doc) {
  return doc.page.width - MARGEM * 2;
}

export function cabecalho(doc: Doc, tenant: Tenant, direita: string[], titulo: string) {
  const w = largura(doc);
  doc.rect(MARGEM, MARGEM, w, 62).fill(COR.marca);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(12).text(tenant.razaoSocial, MARGEM + 12, MARGEM + 10, { width: w * 0.6 });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .text(`CNPJ ${tenant.cnpj}${tenant.registroMapa ? ` · Registro MAPA ${tenant.registroMapa}` : ""}`, MARGEM + 12, doc.y + 2, { width: w * 0.6 })
    .text(tenant.cidadeUf ?? "", { width: w * 0.6 });
  doc.font("Helvetica-Bold").fontSize(9);
  direita.forEach((l, i) => doc.text(l, MARGEM + w * 0.6, MARGEM + 10 + i * 12, { width: w * 0.4 - 12, align: "right" }));
  doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(14).text(titulo, MARGEM, MARGEM + 76, { width: w });
  doc.moveDown(0.5);
}

export function secao(doc: Doc, titulo: string) {
  garantirEspaco(doc, 60);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.fillColor(COR.marca).font("Helvetica-Bold").fontSize(10).text(titulo.toUpperCase(), MARGEM, y);
  doc.moveTo(MARGEM, doc.y + 2).lineTo(MARGEM + largura(doc), doc.y + 2).strokeColor(COR.linha).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COR.texto);
}

export function garantirEspaco(doc: Doc, altura: number) {
  if (doc.y + altura > doc.page.height - MARGEM - 30) doc.addPage();
}

/** Pares rótulo/valor em duas colunas. */
export function campos(doc: Doc, itens: [string, string | null | undefined][]) {
  const w = largura(doc) / 2 - 8;
  for (let i = 0; i < itens.length; i += 2) {
    garantirEspaco(doc, 30);
    const y = doc.y;
    let maxY = y;
    for (let j = 0; j < 2; j++) {
      const it = itens[i + j];
      if (!it) continue;
      const x = MARGEM + j * (w + 16);
      doc.fillColor(COR.suave).font("Helvetica").fontSize(7.5).text(it[0].toUpperCase(), x, y, { width: w });
      doc.fillColor(COR.texto).font("Helvetica").fontSize(10).text(it[1] || "—", x, doc.y + 1, { width: w });
      maxY = Math.max(maxY, doc.y);
    }
    doc.y = maxY + 6;
  }
}

export function rodapes(doc: Doc, texto: string) {
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    const y = doc.page.height - MARGEM + 8;
    const margemInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(COR.suave)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`${texto} · Página ${i + 1} de ${paginas.count}`, MARGEM, y, { width: largura(doc), align: "center", lineBreak: false });
    doc.page.margins.bottom = margemInferior;
  }
}

export function paraBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((ok, erro) => {
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => ok(Buffer.concat(partes)));
    doc.on("error", erro);
    doc.end();
  });
}

const TZ = "America/Sao_Paulo";
export const fmtDataHora = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" });
export const fmtData = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—");

export type Coluna = { titulo: string; peso: number; alinhar?: "left" | "right" | "center" };

/** Tabela simples com cabeçalho repetido a cada página. */
export function tabela(doc: Doc, colunas: Coluna[], linhas: (string | number | null | undefined)[][], opcoes: { destaque?: (i: number) => boolean } = {}) {
  const w = largura(doc);
  const total = colunas.reduce((s, c) => s + c.peso, 0);
  const larguras = colunas.map((c) => (c.peso / total) * w);
  const xs = larguras.map((_, i) => MARGEM + larguras.slice(0, i).reduce((s, l) => s + l, 0));
  const cabecalhoTabela = () => {
    const y = doc.y;
    doc.rect(MARGEM, y, w, 16).fill("#f1f5f9");
    doc.fillColor(COR.suave).font("Helvetica-Bold").fontSize(7.5);
    colunas.forEach((c, i) => doc.text(c.titulo.toUpperCase(), xs[i] + 4, y + 5, { width: larguras[i] - 8, align: c.alinhar ?? "left", lineBreak: false }));
    doc.y = y + 19;
  };
  garantirEspaco(doc, 40);
  cabecalhoTabela();
  linhas.forEach((linha, li) => {
    doc.font("Helvetica").fontSize(8.5);
    const altura = Math.max(...linha.map((v, i) => doc.heightOfString(String(v ?? "—"), { width: larguras[i] - 8 }))) + 6;
    if (doc.y + altura > doc.page.height - MARGEM - 30) {
      doc.addPage();
      cabecalhoTabela();
    }
    const y = doc.y;
    if (opcoes.destaque?.(li)) doc.rect(MARGEM, y - 2, w, altura).fill("#fef2f2");
    doc.fillColor(COR.texto).font("Helvetica").fontSize(8.5);
    linha.forEach((v, i) => doc.text(String(v ?? "—"), xs[i] + 4, y + 1, { width: larguras[i] - 8, align: colunas[i].alinhar ?? "left" }));
    doc.y = y + altura;
    doc.moveTo(MARGEM, doc.y - 1).lineTo(MARGEM + w, doc.y - 1).strokeColor(COR.linha).lineWidth(0.5).stroke();
  });
  doc.x = MARGEM;
  doc.moveDown(0.3);
}

/** Bloco de assinatura eletrônica com hash. */
export function blocoAssinatura(doc: Doc, a: { nome: string; detalhe: string; hash: string }) {
  const w = largura(doc);
  garantirEspaco(doc, 90);
  const ya = doc.y;
  doc.roundedRect(MARGEM, ya, w, 82, 6).strokeColor(COR.marca).lineWidth(1).stroke();
  doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(10).text(a.nome, MARGEM + 12, ya + 10);
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .text(a.detalhe, { width: w - 24 })
    .text("Assinado eletronicamente mediante senha pessoal e intransferível. Integridade verificável pelo hash SHA-256 do conteúdo:", { width: w - 24 })
    .font("Courier")
    .fontSize(8)
    .text(a.hash, { width: w - 24 });
  doc.y = ya + 90;
  doc.x = MARGEM;
}
