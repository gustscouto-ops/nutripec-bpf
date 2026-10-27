import type { IdentidadeRegistros } from "@prisma/client";
import { prisma } from "../db";
import { atualizarAuditado, criarAuditado } from "../audit";
import { ErroNegocio } from "../erros";
import { lerArquivo, salvarArquivo } from "../storage";
import type { Ctx } from "../auth";

/**
 * Cabeçalho e rodapé dos RQs impressos: nome e logo da empresa no cabeçalho e, no rodapé,
 * quem elabora/verifica (RT), monitora (controle de qualidade) e aprova (proprietário) os formulários.
 */

export type DadosIdentidade = {
  nomeCabecalho: string;
  rtNome: string;
  rtRegistro: string;
  controleQualidade: string;
  proprietario: string;
};

export type Identidade = DadosIdentidade & { logo: { conteudo: Buffer; mime: string } | null; temLogo: boolean; salvo: boolean };

const TIPOS_LOGO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };
const MAX_LOGO = 2 * 1024 * 1024;

/** O que foi salvo ou, na primeira vez, sugestões do manual de BPF, do cadastro da empresa e do RT. */
export async function dadosIdentidade(tenantId: string): Promise<DadosIdentidade & { logoArquivo: string | null; logoMime: string | null; salvo: boolean }> {
  const salva = await prisma.identidadeRegistros.findUnique({ where: { tenantId } });
  if (salva) return { ...salva, salvo: true };
  const [tenant, manual, rt] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.manualBpfConfig.findUnique({ where: { tenantId } }),
    prisma.membership.findFirst({ where: { tenantId, perfil: "RT", ativo: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    nomeCabecalho: (tenant.nomeFantasia || tenant.razaoSocial).toUpperCase(),
    rtNome: manual?.rtNome || rt?.user.nome || "",
    rtRegistro: manual?.rtRegistro || rt?.user.registroProfissional || "",
    controleQualidade: manual?.controleQualidade ?? "",
    proprietario: manual?.responsavelLegal ?? "",
    logoArquivo: null,
    logoMime: null,
    salvo: false,
  };
}

/** Identidade pronta para o PDF (com a imagem do logo carregada). */
export async function identidadeParaPdf(tenantId: string): Promise<Identidade> {
  const d = await dadosIdentidade(tenantId);
  let logo: Identidade["logo"] = null;
  if (d.logoArquivo && d.logoMime) {
    try {
      logo = { conteudo: await lerArquivo(d.logoArquivo), mime: d.logoMime };
    } catch {
      logo = null; // arquivo removido do armazenamento: o cabeçalho sai sem logo
    }
  }
  return { nomeCabecalho: d.nomeCabecalho, rtNome: d.rtNome, rtRegistro: d.rtRegistro, controleQualidade: d.controleQualidade, proprietario: d.proprietario, logo, temLogo: !!logo, salvo: d.salvo };
}

export async function salvarIdentidade(ctx: Ctx, entrada: DadosIdentidade, logo?: { conteudo: Buffer; mime: string } | null, removerLogo = false) {
  const limpo = Object.fromEntries(Object.entries(entrada).map(([k, v]) => [k, String(v ?? "").trim()])) as DadosIdentidade;
  const erros: Record<string, string> = {};
  if (!limpo.nomeCabecalho) erros.nomeCabecalho = "Informe o nome que aparece no cabeçalho";
  if (!limpo.rtNome) erros.rtNome = "Informe o Responsável Técnico";
  if (Object.keys(erros).length) throw new ErroNegocio("Preencha os campos destacados.", erros);
  let arquivo: { logoArquivo: string | null; logoMime: string | null } | undefined;
  if (logo && logo.conteudo.length) {
    if (!TIPOS_LOGO[logo.mime]) throw new ErroNegocio("O logo precisa ser PNG ou JPG.");
    if (logo.conteudo.length > MAX_LOGO) throw new ErroNegocio("O logo deve ter até 2 MB.");
    arquivo = { logoArquivo: await salvarArquivo(ctx.tenantId, logo.conteudo, TIPOS_LOGO[logo.mime]), logoMime: logo.mime };
  } else if (removerLogo) {
    arquivo = { logoArquivo: null, logoMime: null };
  }
  return prisma.$transaction(async (tx) => {
    const atual = await tx.identidadeRegistros.findUnique({ where: { tenantId: ctx.tenantId } });
    if (atual) return atualizarAuditado<IdentidadeRegistros>(tx, ctx, "identidadeRegistros", atual.id, { ...limpo, ...(arquivo ?? {}) });
    return criarAuditado<IdentidadeRegistros>(tx, ctx, "identidadeRegistros", { ...limpo, ...(arquivo ?? {}), tenantId: ctx.tenantId });
  });
}
