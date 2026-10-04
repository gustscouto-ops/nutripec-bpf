import type { Tenant } from "@prisma/client";
import { prisma } from "../db";
import { ROTULO_FREQUENCIA } from "../rq/catalogo";
import { ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_STATUS_NC } from "../servicos/nc";
import type { ResumoDossie } from "../servicos/dossie";
import { COR, MARGEM, cabecalho, campos, fmtData, fmtDataHora, garantirEspaco, largura, novoDocumento, paraBuffer, rodapes, secao, tabela } from "./base";

const periodo = (r: { de: Date; ate: Date }) => `${fmtData(r.de)} a ${fmtData(new Date(r.ate.getTime() - 1))}`;

/** Capa e índice do dossiê: resumo por POP, cobertura da agenda e lista de documentos do pacote. */
export async function pdfIndiceDossie(tenant: Tenant, resumo: ResumoDossie, documentos: { pasta: string; arquivos: number }[], geradoPor: string) {
  const doc = novoDocumento(`Dossiê de fiscalização ${periodo(resumo)}`);
  cabecalho(doc, tenant, ["Dossiê de Fiscalização", `Período ${periodo(resumo)}`, `Gerado em ${fmtDataHora(new Date())}`], "Dossiê de Boas Práticas de Fabricação (IN MAPA nº 04/2007)");
  campos(doc, [
    ["Estabelecimento", `${tenant.razaoSocial} · CNPJ ${tenant.cnpj}`],
    ["Registro no MAPA", tenant.registroMapa],
    ["Endereço", [tenant.endereco, tenant.cidadeUf].filter(Boolean).join(" · ")],
    ["Gerado por", geradoPor],
    ["Registros da qualidade no período", String(resumo.totalRegistros)],
    ["Cobertura da agenda de RQs", resumo.cobertura === null ? "—" : `${resumo.cobertura.toLocaleString("pt-BR")}% dos períodos com registro`],
    ["Não conformidades abertas no período", `${resumo.ncs.total} (${resumo.ncs.encerradas} encerradas, ${resumo.ncs.abertas} em tratamento, ${resumo.ncs.canceladas} canceladas)`],
    ["Simulados / recolhimentos", String(resumo.recalls)],
  ]);

  secao(doc, "Registros por POP");
  for (const p of resumo.pops) {
    garantirEspaco(doc, 60);
    doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(9.5).text(`POP ${String(p.numero).padStart(2, "0")} — ${p.titulo}`, MARGEM, doc.y);
    doc.moveDown(0.2);
    tabela(
      doc,
      [
        { titulo: "RQ", peso: 0.8 },
        { titulo: "Registro", peso: 3 },
        { titulo: "Frequência", peso: 1.2 },
        { titulo: "Cobertura", peso: 1.1, alinhar: "right" },
        { titulo: "Registros", peso: 0.9, alinhar: "right" },
        { titulo: "Conformes", peso: 0.9, alinhar: "right" },
        { titulo: "Fora do prazo", peso: 1, alinhar: "right" },
      ],
      p.rqs.map((r) => [
        r.codigoRq,
        r.titulo,
        ROTULO_FREQUENCIA[r.frequencia as keyof typeof ROTULO_FREQUENCIA],
        r.esperados === null ? "sob demanda" : `${r.cobertos}/${r.esperados}`,
        r.registros,
        r.conformes,
        r.atrasados,
      ]),
      { destaque: (i) => p.rqs[i].esperados !== null && p.rqs[i].cobertos < p.rqs[i].esperados! },
    );
  }

  secao(doc, "Conteúdo do pacote");
  tabela(
    doc,
    [
      { titulo: "Pasta / arquivo", peso: 4 },
      { titulo: "Arquivos", peso: 1, alinhar: "right" },
    ],
    documentos.map((d) => [d.pasta, d.arquivos]),
  );
  doc.font("Helvetica").fontSize(8.5).fillColor(COR.suave).text(
    "A integridade de cada arquivo pode ser conferida pelo SHA-256 listado em MANIFESTO-SHA256.txt. Cada registro da qualidade traz, além disso, o hash da assinatura eletrônica do conteúdo, verificável no sistema.",
    MARGEM,
    doc.y + 4,
    { width: largura(doc) },
  );
  rodapes(doc, `NutriPEC Gestão BPF · Dossiê ${periodo(resumo)}`);
  return paraBuffer(doc);
}

/** Relatório consolidado das não conformidades do período, com o ciclo completo de tratamento. */
export async function pdfNcsPeriodo(tenant: Tenant, de: Date, ate: Date) {
  const ncs = await prisma.naoConformidade.findMany({ where: { tenantId: tenant.id, abertaEm: { gte: de, lt: ate } }, include: { fornecedor: { select: { razaoSocial: true } } }, orderBy: { numero: "asc" } });
  const doc = novoDocumento("Não conformidades");
  cabecalho(doc, tenant, ["Não conformidades", `Período ${periodo({ de, ate })}`], "Relatório de Não Conformidades e Ações Corretivas/Preventivas");
  if (!ncs.length) doc.font("Helvetica").fontSize(10).text("Nenhuma não conformidade aberta no período.", MARGEM, doc.y);
  tabela(
    doc,
    [
      { titulo: "NC", peso: 0.6 },
      { titulo: "Título", peso: 3 },
      { titulo: "Origem", peso: 1.4 },
      { titulo: "Aberta", peso: 1 },
      { titulo: "Prazo", peso: 1 },
      { titulo: "Situação", peso: 1.3 },
    ],
    ncs.map((n) => [String(n.numero).padStart(4, "0"), n.titulo, ROTULO_ORIGEM_NC[n.origem], fmtData(n.abertaEm), fmtData(n.prazo), ROTULO_STATUS_NC[n.status]]),
  );
  const w = largura(doc);
  for (const n of ncs) {
    secao(doc, `NC ${String(n.numero).padStart(4, "0")} — ${n.titulo}`);
    campos(doc, [
      ["Origem / gravidade", `${ROTULO_ORIGEM_NC[n.origem]} · ${ROTULO_GRAVIDADE[n.gravidade]}`],
      ["Fornecedor / lote", [n.fornecedor?.razaoSocial, n.loteReferencia].filter(Boolean).join(" · ") || null],
      ["Aberta por", `${n.abertaPorNome} em ${fmtDataHora(n.abertaEm)}`],
      ["Situação", ROTULO_STATUS_NC[n.status]],
    ]);
    const bloco = (titulo: string, texto: string | null | undefined, rodape?: string | null) => {
      if (!texto) return;
      garantirEspaco(doc, 40);
      doc.fillColor(COR.texto).font("Helvetica-Bold").fontSize(9).text(titulo, MARGEM, doc.y, { width: w });
      doc.font("Helvetica").fontSize(9).text(texto, { width: w });
      if (rodape) doc.fillColor(COR.suave).fontSize(7.5).text(rodape, { width: w });
      doc.moveDown(0.3);
    };
    bloco("Ocorrido", n.descricao);
    bloco("Ação imediata", n.acaoImediata);
    bloco("Causa raiz", n.causaRaiz);
    bloco("Ação preventiva", n.acaoPreventiva, n.planoPorNome ? `${n.planoPorNome} · ${n.planoEm ? fmtDataHora(n.planoEm) : ""} · responsável ${n.responsavelAcao ?? "—"} · prazo ${fmtData(n.prazo)}` : null);
    bloco("Execução", n.execucaoDescricao, n.executadaPorNome ? `${n.executadaPorNome} · ${n.executadaEm ? fmtDataHora(n.executadaEm) : ""}` : null);
    bloco("Verificação de eficácia", n.verificacaoEficacia, n.encerradaPorNome ? `${n.encerradaPorNome} · ${n.encerradaEm ? fmtDataHora(n.encerradaEm) : ""}${n.hashEncerramento ? ` · SHA-256 ${n.hashEncerramento}` : ""}` : null);
  }
  rodapes(doc, `NutriPEC Gestão BPF · Não conformidades ${periodo({ de, ate })}`);
  return paraBuffer(doc);
}
