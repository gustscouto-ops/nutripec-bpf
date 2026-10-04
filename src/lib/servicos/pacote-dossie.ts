import JSZip from "jszip";
import { prisma, num } from "../db";
import { registrarAuditoria } from "../audit";
import { csv } from "../csv";
import { sha256 } from "../hash";
import { pdfRq } from "../pdf/rq";
import { pdfRecall } from "../pdf/recall";
import { pdfIndiceDossie, pdfNcsPeriodo } from "../pdf/dossie";
import { chaveDia } from "../agenda";
import type { Ctx } from "../auth";
import { intervalo, resumoDossie } from "./dossie";

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w ()-]/g, "")
    .trim();
const d = (v: Date | null | undefined) => (v ? v.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const dh = (v: Date | null | undefined) => (v ? v.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

/**
 * Monta o pacote ZIP do dossiê: índice, PDFs de todos os RQs do período organizados por POP,
 * relatório de não conformidades, simulados de recall, planilhas de rastreabilidade e cadastros,
 * trilha de auditoria e manifesto SHA-256 de cada arquivo.
 */
export async function gerarPacoteDossie(ctx: Ctx, inicio: string, fim: string) {
  const { de, ate } = intervalo(inicio, fim);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const resumo = await resumoDossie(ctx.tenantId, de, ate);
  const raiz = `Dossie-MAPA-${semAcento(tenant.nomeFantasia ?? tenant.razaoSocial).replace(/\s+/g, "-")}-${inicio}-a-${fim}`;
  const arquivos = new Map<string, Buffer>();
  const pastas = new Map<string, number>();
  const add = (caminho: string, conteudo: Buffer | string) => {
    arquivos.set(caminho, Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, "utf8"));
    const pasta = caminho.includes("/") ? caminho.split("/")[0] : caminho;
    pastas.set(pasta, (pastas.get(pasta) ?? 0) + 1);
  };

  // 1. Registros da qualidade, por POP
  const execucoes = await prisma.rqExecucao.findMany({
    where: { tenantId: ctx.tenantId, dataHoraExecucao: { gte: de, lt: ate } },
    select: { id: true, codigoRq: true, numero: true, dataHoraExecucao: true, modelo: { select: { pop: { select: { numeroPop: true, titulo: true } } } } },
    orderBy: [{ codigoRq: "asc" }, { numero: "asc" }],
  });
  for (const e of execucoes) {
    const pop = e.modelo.pop;
    const pasta = `POP-${String(pop.numeroPop).padStart(2, "0")} ${semAcento(pop.titulo)}`;
    const pdf = await pdfRq(ctx.tenantId, e.id);
    if (pdf) add(`${pasta}/${e.codigoRq.replace(" ", "-")} n${String(e.numero).padStart(4, "0")} ${chaveDia(e.dataHoraExecucao)}.pdf`, pdf);
  }

  // 2. Não conformidades
  add("Nao-conformidades.pdf", await pdfNcsPeriodo(tenant, de, ate));

  // 3. Simulados e recolhimentos
  const recalls = await prisma.recallRegistro.findMany({ where: { tenantId: ctx.tenantId, concluidoEm: { gte: de, lt: ate } }, orderBy: { numero: "asc" } });
  for (const r of recalls) {
    const pdf = await pdfRecall(ctx.tenantId, r.id);
    if (pdf) add(`Recall/${r.tipo === "SIMULADO" ? "Simulado" : "Recolhimento"} n${String(r.numero).padStart(4, "0")} ${r.alvoCodigo.replace(/[^\w-]/g, "_")}.pdf`, pdf);
  }

  // 4. Rastreabilidade do período (entrada, produção com consumo, saída)
  const [lotes, ordens, envios] = await Promise.all([
    prisma.loteMateriaPrima.findMany({ where: { tenantId: ctx.tenantId, dataRecebimento: { gte: de, lt: ate } }, include: { materiaPrima: true, fornecedor: true }, orderBy: { dataRecebimento: "asc" } }),
    prisma.producaoOrdem.findMany({
      where: { tenantId: ctx.tenantId, dataHoraInicio: { gte: de, lt: ate } },
      include: { produto: true, consumos: { include: { lote: { include: { materiaPrima: true } } } } },
      orderBy: { dataHoraInicio: "asc" },
    }),
    prisma.expedicaoEnvio.findMany({ where: { tenantId: ctx.tenantId, dataHora: { gte: de, lt: ate } }, include: { ordem: { include: { produto: true } } }, orderBy: { dataHora: "asc" } }),
  ]);
  add(
    "Rastreabilidade/1-entrada-lotes-mp.csv",
    csv([
      ["Lote interno", "Matéria-prima", "Fornecedor", "CNPJ", "NF", "Lote fornecedor", "Recebimento", "Quantidade (kg)", "Situação", "Decisão RT"],
      ...lotes.map((l) => [l.codigoLoteInterno, l.materiaPrima.nomeComercial, l.fornecedor.razaoSocial, l.fornecedor.cnpj, l.numeroNf, l.loteFornecedor, dh(l.dataRecebimento), num(l.quantidadeKg), l.status, l.decisaoRtNome ? `${l.decisaoRtNome} ${dh(l.decisaoRtEm)}: ${l.decisaoRtMotivo ?? ""}` : ""]),
    ]),
  );
  add(
    "Rastreabilidade/2-producao-consumo.csv",
    csv([
      ["Lote produto", "Produto", "Seq. dia", "Início", "Turno", "Misturador", "Bateladas", "Sacas", "Versão fórmula", "Operador", "Lote MP", "Matéria-prima", "Consumo (kg)"],
      ...ordens.flatMap((o) =>
        (o.consumos.length ? o.consumos : [null]).map((c) => [
          o.codigoLoteProduzido,
          `${o.produto.codigo} ${o.produto.nome}`,
          o.sequenciaDia,
          dh(o.dataHoraInicio),
          o.turno,
          o.misturador,
          o.numeroBateladas,
          o.quantidadeSacasProduzidas,
          o.versaoFormula,
          o.operadorNome,
          c?.lote.codigoLoteInterno ?? "",
          c?.lote.materiaPrima.nomeComercial ?? "",
          c ? num(c.quantidadeUtilizadaKg) : "",
        ]),
      ),
    ]),
  );
  add(
    "Rastreabilidade/3-expedicao.csv",
    csv([
      ["Data", "Cliente", "Documento", "Cidade/UF", "NF", "Placa", "Lote produto", "Produto", "Sacas", "Responsável"],
      ...envios.map((e) => [dh(e.dataHora), e.clienteNome, e.clienteDocumento, e.clienteCidadeUf, e.numeroNf, e.placaVeiculo, e.ordem.codigoLoteProduzido, `${e.ordem.produto.codigo} ${e.ordem.produto.nome}`, e.quantidadeSacas, e.userNome]),
    ]),
  );

  // 5. Cadastros vigentes
  const [fornecedores, produtos] = await Promise.all([
    prisma.fornecedor.findMany({ where: { tenantId: ctx.tenantId }, include: { materiasPrimas: { include: { materiaPrima: true } } }, orderBy: { razaoSocial: "asc" } }),
    prisma.produto.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { codigo: "asc" } }),
  ]);
  add(
    "Cadastros/fornecedores-qualificacao.csv",
    csv([
      ["Fornecedor", "CNPJ", "Registro MAPA", "Situação", "Qualificado em", "Matérias-primas homologadas", "Ativo"],
      ...fornecedores.map((f) => [
        f.razaoSocial,
        f.cnpj,
        f.registroMapa,
        f.statusQualificacao,
        d(f.dataQualificacao),
        f.materiasPrimas.filter((m) => m.homologado).map((m) => m.materiaPrima.nomeComercial).join(", "),
        f.ativo ? "sim" : "não",
      ]),
    ]),
  );
  add(
    "Cadastros/formulas.csv",
    csv([
      ["Código", "Produto", "Registro MAPA", "Versão", "Situação", "Aprovada por", "Aprovada em", "Hash da fórmula"],
      ...produtos.map((p) => [p.codigo, p.nome, p.registroProduto, p.versaoFormula, p.statusFormula, p.aprovadoRtNome, dh(p.dataAprovacaoRt), p.hashFormula]),
    ]),
  );

  // 6. Trilha de auditoria do período
  const trilha = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenantId, createdAt: { gte: de, lt: ate } }, orderBy: { id: "asc" }, take: 50_000 });
  add(
    "Trilha-de-auditoria.csv",
    csv([["#", "Data/hora", "Usuário", "Tabela", "Registro", "Ação", "IP"], ...trilha.map((a) => [a.id.toString(), dh(a.createdAt), a.userNome, a.tabelaAfetada, a.registroId, a.acao, a.ip])]),
  );

  // 7. Índice (lista as pastas) e manifesto
  const documentos = [...pastas.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true })).map(([pasta, n]) => ({ pasta, arquivos: n }));
  const indice = await pdfIndiceDossie(tenant, resumo, documentos, `${ctx.nome} (${ctx.perfil})`);
  const zip = new JSZip();
  const manifesto: string[] = [];
  zip.file(`${raiz}/00-Indice-e-resumo.pdf`, indice);
  manifesto.push(`${sha256(indice)}  00-Indice-e-resumo.pdf`);
  for (const [caminho, conteudo] of arquivos) {
    zip.file(`${raiz}/${caminho}`, conteudo);
    manifesto.push(`${sha256(conteudo)}  ${caminho}`);
  }
  const textoManifesto = `# SHA-256 dos arquivos do dossiê · ${tenant.razaoSocial} · ${inicio} a ${fim} · gerado em ${dh(new Date())} por ${ctx.nome}\n${manifesto.join("\n")}\n`;
  zip.file(`${raiz}/MANIFESTO-SHA256.txt`, textoManifesto);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  await registrarAuditoria(prisma, ctx, {
    tabela: "dossie",
    registroId: `${inicio}_${fim}`,
    acao: "GERACAO_DOSSIE",
    depois: { inicio, fim, arquivos: arquivos.size + 2, registros: execucoes.length, manifesto: sha256(textoManifesto) },
  });
  return { nome: `${raiz}.zip`, buffer, arquivos: arquivos.size + 2, registros: execucoes.length };
}
