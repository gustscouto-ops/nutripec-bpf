import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import type { ManualBpfConfig, ManualBpfEmissao } from "@prisma/client";
import { prisma } from "../db";
import { atualizarAuditado, criarAuditado, registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { jsonCanonico, sha256 } from "../hash";
import { chaveDia } from "../agenda";
import { lerArquivo, salvarArquivo } from "../storage";
import type { Ctx } from "../auth";
import { personalizarXml, validarDados, type DadosManual } from "../manual-bpf";

export const CAMINHO_MODELO = path.join(process.cwd(), "assets/manual-bpf/MBPF-modelo.odt");

type Editaveis = Omit<DadosManual, "razaoSocial" | "cnpj">;

/** Dados do manual da fábrica: o que foi salvo ou, na primeira vez, sugestões tiradas do cadastro da empresa e do RT. */
export async function dadosManual(tenantId: string, hoje = new Date()): Promise<{ dados: DadosManual; salvo: boolean }> {
  const [tenant, config, rt] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.manualBpfConfig.findUnique({ where: { tenantId } }),
    prisma.membership.findFirst({ where: { tenantId, perfil: "RT", ativo: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const base = { razaoSocial: tenant.razaoSocial, cnpj: tenant.cnpj };
  if (config) {
    const { id: _id, tenantId: _t, updatedAt: _u, ...resto } = config;
    return { dados: { ...base, ...resto }, salvo: true };
  }
  const [cidade, uf] = (tenant.cidadeUf ?? "").split(/\s*[/-]\s*(?=[A-Za-z]{2}\s*$)/);
  return {
    salvo: false,
    dados: {
      ...base,
      inscricaoEstadual: "",
      logradouro: tenant.endereco ?? "",
      bairro: "",
      cidade: cidade?.trim() ?? "",
      uf: (uf ?? "").trim().toUpperCase(),
      cep: "",
      telefone: "",
      email: "",
      atividade: "Fabricação de Ração Balanceada, Concentrado e Suplemento Mineral Proteico.",
      cabecalhoLinha1: (tenant.nomeFantasia ?? tenant.razaoSocial).toUpperCase(),
      cabecalhoLinha2: "",
      rtNome: rt?.user.nome ?? "",
      rtRegistro: rt?.user.registroProfissional ?? "",
      responsavelLegal: "",
      responsavelFabrica: "",
      controleQualidade: "",
      dataEmissao: chaveDia(hoje),
      revisao: "02",
    },
  };
}

export async function salvarDadosManual(ctx: Ctx, entrada: Editaveis) {
  const limpo = Object.fromEntries(Object.entries(entrada).map(([k, v]) => [k, String(v ?? "").trim()])) as Editaveis;
  limpo.uf = limpo.uf.toUpperCase();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const campos = validarDados({ ...limpo, razaoSocial: tenant.razaoSocial, cnpj: tenant.cnpj });
  if (Object.keys(campos).length) throw new ErroNegocio("Preencha os campos destacados.", campos);
  return prisma.$transaction(async (tx) => {
    const atual = await tx.manualBpfConfig.findUnique({ where: { tenantId: ctx.tenantId } });
    if (atual) return atualizarAuditado<ManualBpfConfig>(tx, ctx, "manualBpfConfig", atual.id, limpo);
    return criarAuditado<ManualBpfConfig>(tx, ctx, "manualBpfConfig", { ...limpo, tenantId: ctx.tenantId });
  });
}

/** Monta o ODT do modelo com os dados da fábrica (cabeçalhos e rodapés ficam em styles.xml; capa e corpo em content.xml). */
export async function montarOdt(dados: DadosManual, modelo?: Buffer) {
  const zip = await JSZip.loadAsync(modelo ?? (await readFile(CAMINHO_MODELO)));
  const contagem: Record<string, number> = {};
  for (const arquivo of ["content.xml", "styles.xml"]) {
    const r = personalizarXml(await zip.file(arquivo)!.async("string"), dados);
    zip.file(arquivo, r.xml);
    for (const [k, n] of Object.entries(r.contagem)) contagem[k] = (contagem[k] ?? 0) + n;
  }
  // miniatura da primeira página mostraria a capa da Agro Leste no gerenciador de arquivos
  zip.remove("Thumbnails/thumbnail.png");
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  const odt = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/vnd.oasis.opendocument.text" });
  return { odt, contagem };
}

// O LibreOffice não converte dois arquivos ao mesmo tempo com o mesmo perfil: as conversões entram numa fila.
let fila: Promise<unknown> = Promise.resolve();

/** Converte ODT em PDF com o LibreOffice (soffice --headless). Exige o LibreOffice Writer instalado no servidor. */
export function converterParaPdf(odt: Buffer): Promise<Buffer> {
  const tarefa = fila.then(async () => {
    const pasta = await mkdtemp(path.join(tmpdir(), "manual-bpf-"));
    const perfil = path.join(tmpdir(), "nutripec-libreoffice-perfil");
    await mkdir(perfil, { recursive: true });
    try {
      const entrada = path.join(pasta, "manual.odt");
      await writeFile(entrada, odt);
      await new Promise<void>((ok, falha) =>
        execFile(
          process.env.SOFFICE_PATH || "soffice",
          [`-env:UserInstallation=file://${perfil}`, "--headless", "--norestore", "--convert-to", "pdf:writer_pdf_Export", "--outdir", pasta, entrada],
          { timeout: 240_000 },
          (erro, _saida, stderr) => (erro ? falha(new Error(`LibreOffice: ${erro.message} ${stderr}`)) : ok()),
        ),
      );
      return await readFile(path.join(pasta, "manual.pdf")).catch(() => {
        throw new ErroNegocio("O servidor não conseguiu converter o manual em PDF. Verifique se o LibreOffice Writer está instalado (veja o README).");
      });
    } catch (e) {
      if (e instanceof ErroNegocio) throw e;
      console.error(e);
      throw new ErroNegocio("O servidor não conseguiu converter o manual em PDF. Verifique se o LibreOffice Writer está instalado (veja o README).");
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}

export const contarPaginas = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

export function nomeArquivoManual(dados: Pick<DadosManual, "cabecalhoLinha1" | "razaoSocial" | "dataEmissao" | "revisao">) {
  const nome = (dados.cabecalhoLinha1 || dados.razaoSocial)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Manual-BPF-${nome}-${dados.dataEmissao}-rev${dados.revisao}.pdf`;
}

/**
 * Emite o manual com os dados salvos. Mesmos dados = mesma edição (devolve o PDF já emitido, sem nova emissão);
 * dados novos (ex.: nova data de emissão no ano seguinte) = nova edição no histórico.
 */
export async function emitirManual(ctx: Ctx) {
  const config = await prisma.manualBpfConfig.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!config) throw new ErroNegocio("Salve os dados do manual antes de gerar o PDF.");
  const { dados } = await dadosManual(ctx.tenantId);
  const campos = validarDados(dados);
  if (Object.keys(campos).length) throw new ErroNegocio("Há dados obrigatórios do manual em branco. Revise e salve antes de gerar.", campos);
  const modelo = await readFile(CAMINHO_MODELO);
  const hashDados = sha256(jsonCanonico({ dados, modelo: sha256(modelo) }));

  const existente = await prisma.manualBpfEmissao.findUnique({ where: { tenantId_hashDados: { tenantId: ctx.tenantId, hashDados } } });
  if (existente) {
    const pdf = await lerArquivo(existente.arquivo);
    await registrarAuditoria(prisma, ctx, { tabela: "manualBpfEmissao", registroId: existente.id, acao: "DOWNLOAD_MANUAL_BPF", depois: { numero: existente.numero } });
    return { emissao: existente, pdf, nova: false, nome: nomeArquivoManual(dados) };
  }

  const { odt } = await montarOdt(dados, modelo);
  const pdf = await converterParaPdf(odt);
  const arquivo = await salvarArquivo(ctx.tenantId, pdf, "pdf");
  const emissao = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.tenantId}|MANUAL_BPF`}))`;
    const ultimo = await tx.manualBpfEmissao.findFirst({ where: { tenantId: ctx.tenantId }, orderBy: { numero: "desc" }, select: { numero: true } });
    return criarAuditado<ManualBpfEmissao>(tx, ctx, "manualBpfEmissao", {
      tenantId: ctx.tenantId,
      numero: (ultimo?.numero ?? 0) + 1,
      dataEmissao: dados.dataEmissao,
      revisao: dados.revisao,
      dados,
      hashDados,
      hashPdf: sha256(pdf),
      paginas: contarPaginas(pdf),
      arquivo,
      userId: ctx.userId,
      userNome: ctx.nome,
    }, "EMISSAO_MANUAL_BPF");
  });
  return { emissao, pdf, nova: true, nome: nomeArquivoManual(dados) };
}

/** PDF de uma edição anterior, exatamente como foi emitido. */
export async function pdfEmissao(tenantId: string, id: string) {
  const e = await prisma.manualBpfEmissao.findFirst({ where: { id, tenantId } });
  if (!e) return null;
  const dados = e.dados as unknown as DadosManual;
  return { pdf: await lerArquivo(e.arquivo), nome: nomeArquivoManual(dados) };
}

/** A data de emissão tem mais de um ano: hora de reemitir o manual. */
export function emissaoVencida(dataEmissao: string, hoje = new Date()) {
  const [a, m, d] = dataEmissao.split("-").map(Number);
  const limite = `${a + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return chaveDia(hoje) >= limite;
}
