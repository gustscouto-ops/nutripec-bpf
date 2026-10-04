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
