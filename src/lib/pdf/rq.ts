import type { Pop, RqModelo } from "@prisma/client";
import { prisma } from "../db";
import { lerArquivo } from "../storage";
import { ROTULO_PERFIL } from "../permissions";
import type { CampoRq, Respostas } from "../rq/campos";
import { ROTULO_FREQUENCIA } from "../rq/catalogo";
import type { CabecalhoRecebimento } from "../servicos/recebimento";
import { CODIGO_RQ_RECEBIMENTO } from "../servicos/rq";
import { revisaoDoRegistro } from "../servicos/modelos";
import { identidadeParaPdf } from "../servicos/identidade";
import { fmtData, fmtDataHora } from "./base";
import {
  CINZA,
  LARGURA_UTIL as W,
  MARGEM_LATERAL as M,
  PRETO,
  VERDE,
  VERMELHO,
  assinaturas,
  corpoEmBranco,
  emoldurar,
  espaco,
  grade,
  linhaInfo,
  novoFormulario,
  paraBuffer,
  subtitulo,
  t,
  tabelaRespostas,
  type InfoCabecalho,
} from "./formulario";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const pop2 = (n: number) => String(n).padStart(2, "0");

export function prazoDoModelo(m: Pick<RqModelo, "frequencia" | "diaSemana" | "diaMes">) {
  if (m.frequencia === "SEMANAL" || m.frequencia === "QUINZENAL") return `até ${DIAS[m.diaSemana ?? 5]}`;
  if (["MENSAL", "SEMESTRAL", "ANUAL"].includes(m.frequencia) && m.diaMes) return `até o dia ${m.diaMes}`;
  return undefined;
}

/**
 * PDF de qualquer RQ assinado, gerado sempre a partir do registro imutável no banco, no formato do formulário
 * da fábrica (cabeçalho com logo, código, revisão e data; rodapé com RT, controle de qualidade e proprietário).
 * Usa a cópia dos campos gravada na assinatura e a revisão em que o registro foi feito.
 */
export async function pdfRq(tenantId: string, rqId: string): Promise<Buffer | null> {
  const rq = await prisma.rqExecucao.findFirst({
    where: { id: rqId, tenantId },
    include: { modelo: { include: { pop: true } }, fotos: true, loteMp: true, naoConformidades: { orderBy: { numero: "asc" } }, verificacao: true },
  });
  if (!rq) return null;
  const [ident, revisao, assinante] = await Promise.all([
    identidadeParaPdf(tenantId),
    revisaoDoRegistro(tenantId, rq.codigoRq, rq.versaoModelo),
    prisma.user.findUnique({ where: { id: rq.userIdAssinatura }, select: { registroProfissional: true } }),
  ]);
  const recebimento = rq.codigoRq === CODIGO_RQ_RECEBIMENTO;
  const c = rq.cabecalho as unknown as CabecalhoRecebimento & { periodo?: string };
  const respostas = rq.respostas as unknown as Respostas;
  const camposRq = ((rq.campos as unknown as CampoRq[]).length ? rq.campos : rq.modelo.campos) as unknown as CampoRq[];
  const numero = String(rq.numero).padStart(4, "0");
  const titulo = revisao?.titulo ?? rq.modelo.titulo;
  const frequencia = revisao?.frequencia ?? rq.modelo.frequencia;

  const doc = novoFormulario(`${rq.codigoRq} nº ${numero}${recebimento ? ` — ${c.codigoLoteInterno}` : ""}`);
  linhaInfo(doc, [
    ["FREQUÊNCIA", ROTULO_FREQUENCIA[frequencia].toUpperCase()],
    ["POP", `${pop2(rq.modelo.pop.numeroPop)} - ${rq.modelo.pop.titulo}`],
  ]);
  doc.moveDown(0.3);

  const conforme = rq.status === "CONFORME";
  const situacao = rq.loteMp
    ? { LIBERADO: "Lote liberado para produção", QUARENTENA: "Lote em quarentena (aguarda RT)", REPROVADO: "Lote reprovado" }[rq.loteMp.status]
    : rq.atrasado
      ? "Registrado fora do prazo"
      : "No prazo";
  grade(
    doc,
    [
      { titulo: "Registro nº", peso: 1, alinhar: "center" },
      { titulo: recebimento ? "Lote interno" : "Referência", peso: 1.6, alinhar: "center" },
      { titulo: "Data/hora do registro", peso: 1.5, alinhar: "center" },
      { titulo: "Resultado", peso: 1.3, alinhar: "center" },
      { titulo: "Situação", peso: 1.7, alinhar: "center" },
    ],
    [
      [
        { texto: numero, negrito: true },
        { texto: recebimento ? c.codigoLoteInterno : (c.periodo ?? fmtData(rq.referenciaInicio)), negrito: true },
        fmtDataHora(rq.dataHoraExecucao),
        { texto: conforme ? "CONFORME" : "NÃO CONFORME", negrito: true, cor: conforme ? VERDE : VERMELHO },
        { texto: situacao, cor: rq.atrasado ? VERMELHO : PRETO },
      ],
    ],
    { alturaMin: 18 },
  );

  if (recebimento) {
    subtitulo(doc, "Dados da carga");
    const pares: [string, string | null | undefined][] = [
      ["Fornecedor", `${c.fornecedor.razaoSocial} - CNPJ ${c.fornecedor.cnpj}`],
      ["Registro MAPA do fornecedor", c.fornecedor.registroMapa],
      ["Matéria-prima", c.materiaPrima.nome],
      ["Nota fiscal", c.numeroNf],
      ["Peso total da carga", `${c.quantidadeKg.toLocaleString("pt-BR")} kg`],
      ["Lote do fornecedor", c.loteFornecedor],
      ["Data de fabricação", fmtData(c.dataFabricacao ? `${c.dataFabricacao}T12:00:00Z` : null)],
      ["Data de validade", fmtData(c.dataValidade ? `${c.dataValidade}T12:00:00Z` : null)],
      ["Placa do veículo", c.placaVeiculo],
      ["Transportadora / motorista", [c.transportadora, c.motorista].filter(Boolean).join(" / ") || null],
    ];
    const linhas = [];
    for (let i = 0; i < pares.length; i += 2) linhas.push([{ texto: pares[i][0], negrito: true }, pares[i][1] || "—", { texto: pares[i + 1][0], negrito: true }, pares[i + 1][1] || "—"]);
    grade(doc, [{ titulo: "", peso: 1.1 }, { titulo: "", peso: 1.7 }, { titulo: "", peso: 1.1 }, { titulo: "", peso: 1.7 }], linhas, { semCabecalho: true, alturaMin: 16 });
  }

  subtitulo(doc, recebimento ? "Checklist de inspeção" : "Itens verificados");
  tabelaRespostas(doc, camposRq, respostas);
  if (rq.observacoes) {
    espaco(doc, 30);
    doc.moveDown(0.4).fillColor(PRETO).font("Helvetica-Bold").fontSize(8.5).text("Observações: ", M, doc.y, { continued: true }).font("Helvetica").text(t(rq.observacoes), { width: W });
  }

  if (rq.fotos.length) {
    const colW = (W - 12) / 2;
    const altura = colW * 0.6;
    espaco(doc, altura + 60); // não deixa o título da seção órfão no fim da página
    subtitulo(doc, `Evidências fotográficas (${rq.fotos.length})`);
    for (let i = 0; i < rq.fotos.length; i += 2) {
      espaco(doc, altura + 24);
      const yy = doc.y;
      for (let j = 0; j < 2; j++) {
        const f = rq.fotos[i + j];
        if (!f) continue;
        const x = M + j * (colW + 12);
        try {
          if (f.mimeType === "image/webp") throw new Error("webp");
          doc.image(await lerArquivo(f.fotoUrl), x, yy, { fit: [colW, altura], align: "center", valign: "center" });
        } catch {
          doc.rect(x, yy, colW, altura).strokeColor(CINZA).stroke();
          doc.fillColor(CINZA).fontSize(8).text("Imagem disponível no sistema", x, yy + altura / 2, { width: colW, align: "center" });
        }
        doc.fillColor(CINZA).font("Helvetica").fontSize(7).text(t(`Foto ${i + j + 1}${f.descricao ? ` - ${f.descricao}` : ""} · SHA-256 ${f.hashArquivo.slice(0, 16)}…`), x, yy + altura + 3, { width: colW });
      }
      doc.x = M;
      doc.y = yy + altura + 18;
    }
  }

  if (rq.naoConformidades.length) {
    subtitulo(doc, "Relatório de não conformidade");
    grade(
      doc,
      [
        { titulo: "NC", peso: 0.7, alinhar: "center" },
        { titulo: "Descrição", peso: 3 },
        { titulo: "Ação imediata", peso: 2.6 },
        { titulo: "Situação na emissão", peso: 1.2, alinhar: "center" },
      ],
      rq.naoConformidades.map((n) => [String(n.numero).padStart(4, "0"), `${n.titulo}\n${n.descricao}`, n.acaoImediata, n.status.toLowerCase().replace(/_/g, " ")]),
    );
    doc.fillColor(CINZA).font("Helvetica").fontSize(7).text("Causa, ação preventiva e verificação da eficácia são tratadas e assinadas no módulo de não conformidades.", M, doc.y + 3, { width: W });
  }

  if (rq.loteMp?.decisaoRtEm) {
    subtitulo(doc, "Decisão do Responsável Técnico");
    grade(
      doc,
      [{ titulo: "Decisão", peso: 1.2 }, { titulo: "Responsável / data", peso: 2 }, { titulo: "Justificativa", peso: 3 }],
      [[rq.loteMp.status === "LIBERADO" ? "Liberado com ressalva" : "Reprovado", `${rq.loteMp.decisaoRtNome} - ${fmtDataHora(rq.loteMp.decisaoRtEm)}`, rq.loteMp.decisaoRtMotivo ?? "—"]],
    );
  }

  const v = rq.verificacao;
  assinaturas(
    doc,
    { nome: rq.nomeAssinatura, perfil: ROTULO_PERFIL[rq.perfilAssinatura], registro: assinante?.registroProfissional, dataHora: rq.dataHoraExecucao, hash: rq.hashAssinatura, ip: rq.ipOrigem },
    v ? { nome: v.nome, perfil: ROTULO_PERFIL[v.perfil], registro: v.registroProfissional, dataHora: v.dataHora, hash: v.hash, ip: v.ip, parecer: v.parecer } : null,
  );

  const info: InfoCabecalho = {
    codigo: `${rq.codigoRq} / POP ${pop2(rq.modelo.pop.numeroPop)}`,
    revisao: rq.versaoModelo,
    dataRevisao: revisao?.dataRevisao ?? (rq.modelo.versao === rq.versaoModelo ? rq.modelo.dataRevisao : null),
    titulo,
    rodape: `NutriPEC Gestão BPF · ${rq.codigoRq} nº ${numero} · documento gerado em ${fmtDataHora(new Date())}`,
  };
  emoldurar(doc, ident, [{ inicio: 0, info }]);
  return paraBuffer(doc);
}

/**
 * Formulários em branco (modelo aprovado, para anexar ao POP e apresentar à fiscalização),
 * um RQ por vez ou todos os de um POP num único PDF, na revisão vigente de cada um.
 */
export async function pdfFormulariosEmBranco(tenantId: string, modelos: (RqModelo & { pop: Pop })[], tituloDoc: string): Promise<Buffer> {
  const ident = await identidadeParaPdf(tenantId);
  const doc = novoFormulario(tituloDoc);
  const trechos: { inicio: number; info: InfoCabecalho }[] = [];
  modelos.forEach((m, i) => {
    if (i > 0) doc.addPage();
    trechos.push({
      inicio: doc.bufferedPageRange().count - 1,
      info: {
        codigo: `${m.codigoRq} / POP ${pop2(m.pop.numeroPop)}`,
        revisao: m.versao,
        dataRevisao: m.dataRevisao,
        titulo: m.titulo,
        rodape: `${m.codigoRq} rev. ${String(m.versao).padStart(2, "0")} · formulário em branco aprovado para uso · NutriPEC Gestão BPF`,
      },
    });
    corpoEmBranco(doc, {
      codigoRq: m.codigoRq,
      titulo: m.titulo,
      frequencia: m.frequencia,
      campos: m.campos as unknown as CampoRq[],
      orientacoes: m.orientacoes,
      registrosPorFolha: m.registrosPorFolha,
      popNumero: m.pop.numeroPop,
      popTitulo: m.pop.titulo,
      prazo: prazoDoModelo(m),
    });
  });
  emoldurar(doc, ident, trechos);
  return paraBuffer(doc);
}
