import { prisma } from "../db";
import { ROTULO_PERFIL } from "../permissions";
import type { ResultadoRecall } from "../servicos/recall";
import { COR, MARGEM, blocoAssinatura, cabecalho, campos, fmtData, fmtDataHora, largura, novoDocumento, paraBuffer, rodapes, secao, tabela } from "./base";

const kg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

/** Relatório do simulado / recolhimento: origem, lotes de produto afetados, clientes a notificar e estoque a bloquear. */
export async function pdfRecall(tenantId: string, id: string): Promise<Buffer | null> {
  const r = await prisma.recallRegistro.findFirst({ where: { id, tenantId }, include: { tenant: true, rqExecucao: { select: { codigoRq: true, numero: true } } } });
  if (!r) return null;
  const res = r.resultado as unknown as ResultadoRecall;
  const numero = String(r.numero).padStart(4, "0");
  const simulado = r.tipo === "SIMULADO";
  const doc = novoDocumento(`${simulado ? "Simulado de recall" : "Recolhimento"} nº ${numero}`);
  cabecalho(doc, r.tenant, ["POP 08 · Rastreabilidade e Recall", `${simulado ? "Simulado" : "Recolhimento"} nº ${numero}`, fmtDataHora(r.concluidoEm)], simulado ? "Simulado de Recall / Rastreamento de Lote" : "Recolhimento de Produto (Recall)");

  const w = largura(doc);
  const y = doc.y + 4;
  doc.roundedRect(MARGEM, y, w, 46, 6).fillAndStroke(r.completo ? "#f0fdf4" : "#fef2f2", r.completo ? "#bbf7d0" : "#fecaca");
  doc.fillColor(COR.suave).font("Helvetica").fontSize(7.5).text(r.alvoTipo === "LOTE_MP" ? "LOTE DE MATÉRIA-PRIMA SUSPEITO" : "LOTE DE PRODUTO SUSPEITO", MARGEM + 12, y + 8);
  doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(16).text(r.alvoCodigo, MARGEM + 12, y + 19, { width: w / 2 });
  doc
    .fillColor(r.completo ? COR.verde : COR.vermelho)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(r.completo ? "RASTREIO COMPLETO" : "RASTREIO COM PENDÊNCIAS", MARGEM + w / 2, y + 10, { width: w / 2 - 12, align: "right" });
  doc.fillColor(COR.texto).font("Helvetica").fontSize(9).text(`Tempo de rastreio: ${r.duracaoMin} min`, MARGEM + w / 2, y + 26, { width: w / 2 - 12, align: "right" });
  doc.y = y + 56;

  campos(doc, [
    ["Alvo", res.alvo.descricao],
    ["Motivo", r.motivo],
    ["Início / conclusão", `${fmtDataHora(r.iniciadoEm)} → ${fmtDataHora(r.concluidoEm)}`],
    ["Registro da qualidade", r.rqExecucao ? `${r.rqExecucao.codigoRq} nº ${String(r.rqExecucao.numero).padStart(4, "0")}` : simulado ? "RQ 8.1 do período já registrado" : "—"],
  ]);

  secao(doc, "Resumo");
  campos(doc, [
    ["Lotes de matéria-prima envolvidos", String(res.totais.lotesMp)],
    ["Lotes de produto afetados", String(res.totais.ordens)],
    ["Sacas produzidas / expedidas", `${res.totais.sacasProduzidas} / ${res.totais.sacasExpedidas}`],
    ["Sacas em estoque a bloquear", String(res.totais.sacasEstoque)],
    ["Clientes a notificar", String(res.totais.clientes)],
    ["Insumo suspeito dosado", kg(res.totais.kgSuspeitoConsumido)],
  ]);

  if (res.pendencias.length) {
    secao(doc, "Pendências do rastreio");
    doc.fillColor(COR.vermelho).font("Helvetica").fontSize(9);
    res.pendencias.forEach((p) => doc.text(`• ${p}`, MARGEM, doc.y, { width: w }));
    doc.fillColor(COR.texto);
  }

  secao(doc, "Entrada: lotes de matéria-prima");
  tabela(
    doc,
    [
      { titulo: "Lote interno", peso: 1.3 },
      { titulo: "Matéria-prima / fornecedor", peso: 2.6 },
      { titulo: "NF / lote forn.", peso: 1.3 },
      { titulo: "Recebido em", peso: 1 },
      { titulo: "Qtd. recebida", peso: 1, alinhar: "right" },
      { titulo: "Consumido", peso: 1, alinhar: "right" },
      { titulo: "Saldo", peso: 1, alinhar: "right" },
    ],
    res.lotesMp.map((l) => [
      l.codigo,
      `${l.materiaPrima}\n${l.fornecedor} (${l.cnpj})`,
      `${l.nf}${l.loteFornecedor ? `\n${l.loteFornecedor}` : ""}`,
      `${fmtData(l.recebidoEm)}${l.rq ? `\nRQ 1.2 nº ${String(l.rq.numero).padStart(4, "0")}` : "\nsem RQ 1.2"}`,
      kg(l.recebidoKg),
      kg(l.consumidoKg),
      kg(l.saldoKg),
    ]),
    { destaque: (i) => !res.lotesMp[i].rq },
  );

  secao(doc, "Produção: lotes de produto afetados");
  tabela(
    doc,
    [
      { titulo: "Lote", peso: 1.4 },
      { titulo: "Produto", peso: 2.2 },
      { titulo: "Fabricação / validade", peso: 1.5 },
      { titulo: "Insumo suspeito", peso: 1, alinhar: "right" },
      { titulo: "Produzidas", peso: 0.9, alinhar: "right" },
      { titulo: "Expedidas", peso: 0.9, alinhar: "right" },
      { titulo: "Estoque", peso: 0.8, alinhar: "right" },
    ],
    res.ordens.map((o) => [`${o.lote}${o.alvo ? " (alvo)" : ""}`, o.produto, `${fmtData(o.fabricadoEm)}\nval. ${fmtData(o.validade)}`, kg(o.kgSuspeito), o.sacas, o.expedidas, o.estoque]),
  );

  secao(doc, "Saída: clientes a notificar");
  if (res.clientes.length) {
    tabela(
      doc,
      [
        { titulo: "Cliente", peso: 2.4 },
        { titulo: "Documento / cidade", peso: 1.6 },
        { titulo: "NFs (lote · sacas · data)", peso: 3.2 },
        { titulo: "Sacas", peso: 0.8, alinhar: "right" },
      ],
      res.clientes.map((c) => [c.nome, [c.documento, c.cidadeUf].filter(Boolean).join("\n") || "—", c.envios.map((e) => `NF ${e.nf} · ${e.lote} · ${e.sacas} sc · ${fmtData(e.data)}`).join("\n"), c.sacas]),
    );
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(COR.texto).text("Nenhuma expedição dos lotes afetados: todo o produto está em estoque.", MARGEM, doc.y, { width: w });
  }

  secao(doc, "Assinatura eletrônica");
  const assinante = await prisma.user.findUnique({ where: { id: r.userId }, select: { registroProfissional: true } });
  blocoAssinatura(doc, {
    nome: r.userNome,
    detalhe: `${ROTULO_PERFIL[r.perfil]}${assinante?.registroProfissional ? ` · ${assinante.registroProfissional}` : ""} · ${fmtDataHora(r.concluidoEm)}`,
    hash: r.hash,
  });
  rodapes(doc, `NutriPEC Gestão BPF · ${simulado ? "Simulado" : "Recolhimento"} nº ${numero} · Documento gerado em ${fmtDataHora(new Date())}`);
  return paraBuffer(doc);
}
