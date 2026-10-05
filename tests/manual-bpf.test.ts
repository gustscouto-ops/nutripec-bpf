/**
 * Manual de BPF por fábrica: troca dos dados da Agro Leste no modelo ODT e emissão em PDF com histórico.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { ErroNegocio } from "@/lib/erros";
import { personalizarXml, regexTexto, substituir, validarDados, VESTIGIOS, type DadosManual } from "@/lib/manual-bpf";
import { CAMINHO_MODELO, dadosManual, emissaoVencida, emitirManual, montarOdt, salvarDadosManual } from "@/lib/servicos/manual-bpf";

const uid = randomUUID().slice(0, 8);
let ctx: Ctx;

const fabrica: DadosManual = {
  razaoSocial: "Rações Boa Safra & Cia Ltda",
  cnpj: "12.345.678/0001-90",
  inscricaoEstadual: "123.456.789/0012",
  logradouro: "Av. das Indústrias, 1500",
  bairro: "Distrito Industrial",
  cidade: "Uberlândia",
  uf: "MG",
  cep: "38.400-000",
  telefone: "(34)3222-1000",
  email: "qualidade@boasafra.com.br",
  atividade: "Fabricação de rações e suplementos minerais.",
  cabecalhoLinha1: "BOA SAFRA",
  cabecalhoLinha2: "Rações",
  rtNome: "Ana Lima Prado",
  rtRegistro: "CRMV/MG – 9999/Z",
  responsavelLegal: "Carlos Pereira Neto",
  responsavelFabrica: "João Souza Filho",
  controleQualidade: "Marta Dias Rocha",
  dataEmissao: "2027-01-15",
  revisao: "03",
};

const soTexto = (xml: string) => xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
const temSoffice = (() => {
  try {
    execFileSync(process.env.SOFFICE_PATH || "soffice", ["--version"], { stdio: "ignore", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
})();

describe("substituição no XML do modelo", () => {
  it("acha texto quebrado em vários spans e mantém o XML balanceado", () => {
    const xml = '<text:p>Data:<text:span text:style-name="T1">15/</text:span><text:span>01</text:span>/202<text:span>6</text:span></text:p>';
    const r = substituir(xml, "15/01/2026", "15/01/2027");
    expect(r.trocas).toBe(1);
    expect(soTexto(r.xml)).toBe("Data:15/01/2027");
    expect(r.xml.match(/<text:span/g)?.length).toBe(r.xml.match(/<\/text:span>/g)?.length);
  });

  it("não atravessa parágrafos nem casa espaço codificado errado", () => {
    expect(substituir("<text:p>AGRO</text:p><text:p>LESTE</text:p>", "AGROLESTE", "X").trocas).toBe(0);
    expect(regexTexto("Gustavo Souza").test("Gustavo<text:s/>Souza")).toBe(true);
  });

  it("escapa caracteres especiais dos dados da fábrica", () => {
    const r = substituir("<text:p>AGRO LESTE NUTRICAO ANIMAL LTDA</text:p>", "AGRO LESTE NUTRICAO ANIMAL LTDA", "A & B <Ltda>");
    expect(r.xml).toBe("<text:p>A &amp; B &lt;Ltda&gt;</text:p>");
  });

  it("no modelo enviado, troca cabeçalhos, rodapés, capas e datas sem deixar dados da Agro Leste", async () => {
    const zip = await JSZip.loadAsync(await readFile(CAMINHO_MODELO));
    const styles = personalizarXml(await zip.file("styles.xml")!.async("string"), fabrica);
    const content = personalizarXml(await zip.file("content.xml")!.async("string"), fabrica);
    for (const xml of [styles.xml, content.xml]) for (const v of VESTIGIOS) expect(soTexto(xml), v).not.toContain(v);
    expect(styles.contagem["AGRO LESTE NUTRICAO ANIMAL LTDA"]).toBe(49); // um cabeçalho por página-mestra
    expect(styles.contagem["15/01/2026"]).toBeGreaterThan(100);
    expect(styles.contagem.AGROLESTE).toBe(35);
    const textoStyles = soTexto(styles.xml);
    expect(textoStyles).toContain("RAÇÕES BOA SAFRA & CIA LTDA");
    expect(textoStyles).toContain("Aprovado por: Carlos Pereira Neto");
    expect(textoStyles).toContain("Av. das Indústrias, 1500 - Distrito Industrial, Uberlândia - MG, Cep: 38.400-000");
    expect(textoStyles).toContain("REVISÃO: 03");
    const textoCapa = soTexto(content.xml);
    expect(textoCapa).toContain("UBERLÂNDIA-MINAS GERAIS");
    expect(textoCapa).toContain("ANO 2027");
    expect(textoCapa).toContain("CNPJ: 12.345.678/0001-90");
  });
});

describe("regras", () => {
  it("valida campos obrigatórios, UF e revisão", () => {
    expect(validarDados(fabrica)).toEqual({});
    const e = validarDados({ ...fabrica, rtNome: " ", uf: "XX", revisao: "rev 3" });
    expect(Object.keys(e).sort()).toEqual(["revisao", "rtNome", "uf"]);
  });

  it("avisa quando a emissão tem mais de um ano", () => {
    expect(emissaoVencida("2026-01-15", new Date("2027-01-14T15:00:00Z"))).toBe(false);
    expect(emissaoVencida("2026-01-15", new Date("2027-01-15T15:00:00Z"))).toBe(true);
  });
});

describe("emissão por fábrica", () => {
  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { razaoSocial: fabrica.razaoSocial, cnpj: `mb-${uid}`, cidadeUf: "Uberlândia/MG", endereco: "Av. das Indústrias, 1500" } });
    const user = await prisma.user.create({ data: { nome: "Ana Lima Prado", email: `mb-${uid}@teste`, senhaHash: "x", registroProfissional: "CRMV/MG – 9999/Z" } });
    await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, perfil: "RT" } });
    ctx = { userId: user.id, nome: user.nome, tenantId: tenant.id, tenantNome: "Boa Safra", perfil: "RT", ip: null };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sugere dados do cadastro e do RT na primeira vez e exige salvar antes de gerar", async () => {
    const { dados, salvo } = await dadosManual(ctx.tenantId, new Date("2027-01-15T12:00:00Z"));
    expect(salvo).toBe(false);
    expect(dados).toMatchObject({ cidade: "Uberlândia", uf: "MG", rtNome: "Ana Lima Prado", rtRegistro: "CRMV/MG – 9999/Z", dataEmissao: "2027-01-15" });
    await expect(emitirManual(ctx)).rejects.toBeInstanceOf(ErroNegocio);
    await expect(salvarDadosManual(ctx, { ...fabrica, responsavelLegal: "" })).rejects.toThrow(/campos destacados/);
  });

  it("monta um ODT válido com os dados salvos", async () => {
    const { razaoSocial: _r, cnpj: _c, ...editaveis } = fabrica;
    await salvarDadosManual(ctx, editaveis);
    const { dados } = await dadosManual(ctx.tenantId);
    const { odt } = await montarOdt(dados);
    const zip = await JSZip.loadAsync(odt);
    expect(Object.keys(zip.files)[0]).toBe("mimetype");
    expect(soTexto(await zip.file("styles.xml")!.async("string"))).toContain("Ana Lima Prado");
  });

  it.runIf(temSoffice)(
    "gera o PDF, registra a edição e reaproveita quando os dados não mudam; nova data = nova edição",
    async () => {
      const a = await emitirManual(ctx);
      expect(a.nova).toBe(true);
      expect(a.pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(a.emissao.paginas).toBeGreaterThan(90);
      expect(a.nome).toBe("Manual-BPF-BOA-SAFRA-2027-01-15-rev03.pdf");
      const b = await emitirManual(ctx);
      expect(b.nova).toBe(false);
      expect(b.emissao.id).toBe(a.emissao.id);

      const { razaoSocial: _r, cnpj: _c, ...editaveis } = fabrica;
      await salvarDadosManual(ctx, { ...editaveis, dataEmissao: "2028-01-15", revisao: "04" });
      const c = await emitirManual(ctx);
      expect(c.nova).toBe(true);
      expect(c.emissao.numero).toBe(2);
      await expect(prisma.manualBpfEmissao.delete({ where: { id: a.emissao.id } })).rejects.toThrow();
    },
    240_000,
  );
});
