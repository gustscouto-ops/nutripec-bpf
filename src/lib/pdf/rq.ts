import { prisma } from "../db";
import { lerArquivo } from "../storage";
import { ROTULO_PERFIL } from "../permissions";
import type { CampoRq, Respostas } from "../rq/campos";
import type { CabecalhoRecebimento } from "../servicos/recebimento";
import { CODIGO_RQ_RECEBIMENTO } from "../servicos/rq";
import { COR, MARGEM, cabecalho, campos, fmtData, fmtDataHora, garantirEspaco, largura, novoDocumento, paraBuffer, rodapes, secao } from "./base";

const ROT: Record<string, string> = { C: "Conforme", NC: "NÃO CONFORME", NA: "N/A" };

/**
 * PDF de qualquer RQ assinado, gerado sempre a partir do registro imutável no banco.
 * Usa a cópia dos campos gravada na assinatura, então mudanças posteriores no formulário não alteram o documento.
 */
export async function pdfRq(tenantId: string, rqId: string): Promise<Buffer | null> {
  const rq = await prisma.rqExecucao.findFirst({
    where: { id: rqId, tenantId },
    include: { tenant: true, modelo: { include: { pop: true } }, fotos: true, loteMp: true, naoConformidades: { orderBy: { numero: "asc" } } },
  });
  if (!rq) return null;
  const assinante = await prisma.user.findUnique({ where: { id: rq.userIdAssinatura }, select: { registroProfissional: true } });
  const recebimento = rq.codigoRq === CODIGO_RQ_RECEBIMENTO;
  const c = rq.cabecalho as unknown as CabecalhoRecebimento & { periodo?: string };
  const respostas = rq.respostas as unknown as Respostas;
  const camposRq = ((rq.campos as unknown as CampoRq[]).length ? rq.campos : rq.modelo.campos) as unknown as CampoRq[];
  const numero = String(rq.numero).padStart(4, "0");

  const doc = novoDocumento(`${rq.codigoRq} nº ${numero}${recebimento ? ` — ${c.codigoLoteInterno}` : ""}`);
  cabecalho(
    doc,
    rq.tenant,
    [`POP ${String(rq.modelo.pop.numeroPop).padStart(2, "0")} · ${rq.codigoRq} (v${rq.versaoModelo})`, `Registro nº ${numero}`, fmtDataHora(rq.dataHoraExecucao)],
    `${rq.modelo.titulo}`,
  );

  // Identificação e resultado
  const w = largura(doc);
  const y = doc.y + 4;
  const conforme = rq.status === "CONFORME";
  doc.roundedRect(MARGEM, y, w, 46, 6).fillAndStroke(conforme ? "#f0fdf4" : "#fef2f2", conforme ? "#bbf7d0" : "#fecaca");
  doc.fillColor(COR.suave).font("Helvetica").fontSize(7.5).text(recebimento ? "LOTE INTERNO" : "PERÍODO DE REFERÊNCIA", MARGEM + 12, y + 8);
  doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(recebimento ? 18 : 14).text(recebimento ? c.codigoLoteInterno : (c.periodo ?? fmtData(rq.referenciaInicio)), MARGEM + 12, y + 19, { width: w / 2 });
  doc
    .fillColor(conforme ? COR.verde : COR.vermelho)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(conforme ? (recebimento ? "INSPEÇÃO CONFORME" : "CONFORME") : recebimento ? "INSPEÇÃO NÃO CONFORME" : "NÃO CONFORME", MARGEM + w / 2, y + 10, { width: w / 2 - 12, align: "right" });
  const situacao = rq.loteMp
    ? { LIBERADO: "Lote liberado para produção", QUARENTENA: "Lote em quarentena (aguarda RT)", REPROVADO: "Lote reprovado" }[rq.loteMp.status]
    : rq.atrasado
      ? "Registrado fora do prazo"
      : null;
  if (situacao) doc.fillColor(rq.atrasado ? COR.vermelho : COR.texto).font("Helvetica").fontSize(9).text(situacao, MARGEM + w / 2, y + 26, { width: w / 2 - 12, align: "right" });
  doc.y = y + 56;

  if (recebimento) {
    secao(doc, "Dados da carga");
    campos(doc, [
      ["Fornecedor", `${c.fornecedor.razaoSocial} — CNPJ ${c.fornecedor.cnpj}`],
      ["Registro MAPA do fornecedor", c.fornecedor.registroMapa],
      ["Matéria-prima", c.materiaPrima.nome],
      ["Nota fiscal", c.numeroNf],
      ["Peso total da carga", `${c.quantidadeKg.toLocaleString("pt-BR")} kg`],
      ["Lote do fornecedor", c.loteFornecedor],
      ["Data de fabricação", fmtData(c.dataFabricacao ? `${c.dataFabricacao}T12:00:00Z` : null)],
      ["Data de validade", fmtData(c.dataValidade ? `${c.dataValidade}T12:00:00Z` : null)],
      ["Placa do veículo", c.placaVeiculo],
      ["Transportadora / motorista", [c.transportadora, c.motorista].filter(Boolean).join(" / ") || null],
    ]);
  }

  secao(doc, recebimento ? "Checklist de inspeção" : "Itens verificados");
  camposRq.forEach((campo, i) => {
    const r = respostas[campo.id];
    const nc = r?.conforme === false;
    const valor = campo.tipo === "numerico" ? `${r?.valor ?? "—"} ${campo.unidade ?? ""}${nc ? " (fora do limite)" : ""}` : (ROT[String(r?.valor)] ?? "—");
    garantirEspaco(doc, nc ? 60 : 20);
    const yy = doc.y;
    doc.fillColor(COR.texto).font("Helvetica").fontSize(9.5).text(`${i + 1}. ${campo.rotulo}`, MARGEM, yy, { width: w * 0.7 });
    const fim = doc.y;
    doc.fillColor(nc ? COR.vermelho : COR.texto).font(nc ? "Helvetica-Bold" : "Helvetica").text(valor, MARGEM + w * 0.7, yy, { width: w * 0.3, align: "right" });
    doc.y = Math.max(fim, doc.y);
    if (nc) {
      doc.fillColor(COR.vermelho).font("Helvetica").fontSize(8.5);
      doc.text(`Ocorrido: ${r.descricaoNc}`, MARGEM + 14, doc.y + 1, { width: w - 14 });
      doc.text(`Ação corretiva imediata: ${r.acaoCorretiva}`, { width: w - 14 });
    }
    doc.moveTo(MARGEM, doc.y + 3).lineTo(MARGEM + w, doc.y + 3).strokeColor(COR.linha).lineWidth(0.5).stroke();
    doc.y += 6;
  });
  if (rq.observacoes) {
    doc.moveDown(0.3).fillColor(COR.texto).font("Helvetica-Bold").fontSize(9.5).text("Observações: ", MARGEM, doc.y, { continued: true }).font("Helvetica").text(rq.observacoes, { width: w });
  }

  if (rq.fotos.length) {
    const colW = (w - 12) / 2;
    const altura = colW * 0.75;
    garantirEspaco(doc, altura + 70); // não deixa o título da seção órfão no fim da página
    secao(doc, `Evidências fotográficas (${rq.fotos.length})`);
    for (let i = 0; i < rq.fotos.length; i += 2) {
      garantirEspaco(doc, altura + 24);
      const yy = doc.y;
      for (let j = 0; j < 2; j++) {
        const f = rq.fotos[i + j];
        if (!f) continue;
        const x = MARGEM + j * (colW + 12);
        try {
          const img = await lerArquivo(f.fotoUrl);
          if (f.mimeType === "image/webp") throw new Error("webp");
          doc.image(img, x, yy, { fit: [colW, altura], align: "center", valign: "center" });
        } catch {
          doc.rect(x, yy, colW, altura).strokeColor(COR.linha).stroke();
          doc.fillColor(COR.suave).fontSize(8).text("Imagem disponível no sistema", x, yy + altura / 2, { width: colW, align: "center" });
        }
        doc.fillColor(COR.suave).font("Helvetica").fontSize(7.5).text(`Foto ${i + j + 1}${f.descricao ? ` — ${f.descricao}` : ""} · SHA-256 ${f.hashArquivo.slice(0, 16)}…`, x, yy + altura + 3, { width: colW });
      }
      doc.y = yy + altura + 20;
    }
  }

  if (rq.naoConformidades.length) {
    secao(doc, "Não conformidades abertas");
    for (const n of rq.naoConformidades) {
      garantirEspaco(doc, 20);
      doc.fillColor(COR.texto).font("Helvetica").fontSize(9).text(`NC ${String(n.numero).padStart(4, "0")} — ${n.titulo} (situação na emissão: ${n.status.toLowerCase().replace(/_/g, " ")})`, MARGEM, doc.y, { width: w });
    }
  }

  if (rq.loteMp?.decisaoRtEm) {
    secao(doc, "Decisão do Responsável Técnico");
    campos(doc, [
      ["Decisão", rq.loteMp.status === "LIBERADO" ? "Liberado com ressalva" : "Reprovado"],
      ["Responsável / data", `${rq.loteMp.decisaoRtNome} — ${fmtDataHora(rq.loteMp.decisaoRtEm)}`],
    ]);
    doc.font("Helvetica").fontSize(9.5).fillColor(COR.texto).text(`Justificativa: ${rq.loteMp.decisaoRtMotivo}`, MARGEM, doc.y, { width: w });
  }

  secao(doc, "Assinatura eletrônica");
  garantirEspaco(doc, 90);
  const ya = doc.y;
  doc.roundedRect(MARGEM, ya, w, 82, 6).strokeColor(COR.marca).lineWidth(1).stroke();
  doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(10).text(rq.nomeAssinatura, MARGEM + 12, ya + 10);
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .text(`${ROTULO_PERFIL[rq.perfilAssinatura]}${assinante?.registroProfissional ? ` · ${assinante.registroProfissional}` : ""} · ${fmtDataHora(rq.dataHoraExecucao)}${rq.ipOrigem ? ` · IP ${rq.ipOrigem}` : ""}`)
    .text("Assinado eletronicamente mediante senha pessoal e intransferível. Integridade verificável pelo hash SHA-256 do conteúdo:", { width: w - 24 })
    .font("Courier")
    .fontSize(8)
    .text(rq.hashAssinatura, { width: w - 24 });
  doc.y = ya + 90;

  rodapes(doc, `NutriPEC Gestão BPF · ${rq.codigoRq} nº ${numero} · Documento gerado em ${fmtDataHora(new Date())}`);
  return paraBuffer(doc);
}
