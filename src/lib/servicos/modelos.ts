import { Prisma, type Frequencia, type InstrucaoTrabalho, type RqModelo } from "@prisma/client";
import { prisma } from "../db";
import { atualizarAuditado, criarAuditado } from "../audit";
import { ErroNegocio } from "../erros";
import type { CampoRq } from "../rq/campos";
import type { PassoIt } from "../rq/instrucoes";
import type { Ctx } from "../auth";
import { CODIGO_RQ_RECEBIMENTO } from "./rq";

/**
 * Customizador de formulários e de ITs. Modelos padrão (tenantId nulo) nunca são alterados:
 * a primeira edição cria a versão própria da empresa, e cada alteração de campos sobe a versão.
 * Registros já assinados guardam a cópia dos campos vigentes, então não mudam.
 */

const TIPOS = ["conformidade", "numerico", "texto"] as const;
const FREQUENCIAS: Frequencia[] = ["DIARIA", "SEMANAL", "QUINZENAL", "MENSAL", "SEMESTRAL", "ANUAL", "PERIODICA", "QUANDO_OCORRE"];

export function slug(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "campo"
  );
}

/** Valida e normaliza os campos. Mantém o id dos campos existentes (as respostas antigas apontam para ele). */
export function normalizarCampos(entrada: Partial<CampoRq>[]): CampoRq[] {
  if (!entrada.length) throw new ErroNegocio("O formulário precisa de pelo menos um item.");
  const ids = new Set<string>();
  return entrada.map((c, i) => {
    const rotulo = (c.rotulo ?? "").trim();
    if (!rotulo) throw new ErroNegocio(`Item ${i + 1}: informe a pergunta.`);
    if (!TIPOS.includes(c.tipo as (typeof TIPOS)[number])) throw new ErroNegocio(`Item ${i + 1}: tipo inválido.`);
    let id = c.id?.trim() || slug(rotulo);
    for (let n = 2; ids.has(id); n++) id = `${slug(rotulo)}_${n}`;
    ids.add(id);
    const campo: CampoRq = { id, rotulo, tipo: c.tipo as CampoRq["tipo"] };
    if (c.obrigatorio === false) campo.obrigatorio = false;
    if (c.ajuda?.trim()) campo.ajuda = c.ajuda.trim();
    if (campo.tipo === "numerico") {
      const num = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));
      const min = num(c.min);
      const max = num(c.max);
      if (min !== undefined && max !== undefined && min > max) throw new ErroNegocio(`Item ${i + 1}: mínimo maior que o máximo.`);
      if (min !== undefined) campo.min = min;
      if (max !== undefined) campo.max = max;
      if (c.unidade?.trim()) campo.unidade = c.unidade.trim();
      if (c.limiteDinamico) campo.limiteDinamico = c.limiteDinamico;
    }
    return campo;
  });
}

/** JSON com chaves ordenadas: o jsonb do PostgreSQL não preserva a ordem das chaves. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export type ModeloInput = {
  titulo: string;
  frequencia: Frequencia;
  diaSemana?: number | null;
  diaMes?: number | null;
  ativo: boolean;
  campos: Partial<CampoRq>[];
};

export async function salvarModelo(ctx: Ctx, modeloId: string, input: ModeloInput) {
  const atual = await prisma.rqModelo.findFirst({ where: { id: modeloId, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } });
  if (!atual) throw new ErroNegocio("Modelo não encontrado.");
  if (!atual.tenantId) {
    const proprio = await prisma.rqModelo.findFirst({ where: { tenantId: ctx.tenantId, codigoRq: atual.codigoRq } });
    if (proprio) throw new ErroNegocio("A empresa já tem versão própria deste RQ. Recarregue a página.");
  }
  const titulo = input.titulo?.trim();
  if (!titulo) throw new ErroNegocio("Informe o título do RQ.");
  if (!FREQUENCIAS.includes(input.frequencia)) throw new ErroNegocio("Frequência inválida.");
  if (atual.codigoRq === CODIGO_RQ_RECEBIMENTO && input.frequencia !== "QUANDO_OCORRE") {
    throw new ErroNegocio("O RQ 1.2 acontece a cada carga recebida: a frequência é sempre 'quando ocorre'.");
  }
  const campos = normalizarCampos(input.campos);
  const camposMudaram = canonico(campos) !== canonico(atual.campos);
  const dados = {
    titulo,
    frequencia: input.frequencia,
    diaSemana: input.frequencia === "SEMANAL" || input.frequencia === "QUINZENAL" ? (input.diaSemana ?? null) : null,
    diaMes: ["MENSAL", "SEMESTRAL", "ANUAL"].includes(input.frequencia) ? (input.diaMes ?? null) : null,
    ativo: input.ativo,
    campos: campos as unknown as Prisma.InputJsonValue,
    atualizadoPor: ctx.nome,
  };
  return prisma.$transaction(async (tx) => {
    if (!atual.tenantId) {
      return criarAuditado<RqModelo>(
        tx,
        ctx,
        "rqModelo",
        { ...dados, tenantId: ctx.tenantId, origemId: atual.id, popId: atual.popId, codigoRq: atual.codigoRq, versao: atual.versao + 1 },
        "PERSONALIZACAO",
      );
    }
    return atualizarAuditado<RqModelo>(tx, ctx, "rqModelo", atual.id, { ...dados, versao: camposMudaram ? atual.versao + 1 : atual.versao });
  });
}

export async function criarModelo(ctx: Ctx, input: { popId: string; codigoRq: string; titulo: string; frequencia: Frequencia }) {
  const codigoRq = input.codigoRq?.trim().toUpperCase().replace(/^RQ\s*/, "RQ ");
  if (!/^RQ \d+\.\d+$/.test(codigoRq ?? "")) throw new ErroNegocio("Use o formato RQ 2.3.");
  const pop = await prisma.pop.findUnique({ where: { id: input.popId } });
  if (!pop) throw new ErroNegocio("POP inválido.");
  if (!codigoRq.startsWith(`RQ ${pop.numeroPop}.`)) throw new ErroNegocio(`RQs do POP ${pop.numeroPop} começam com RQ ${pop.numeroPop}.`);
  const existe = await prisma.rqModelo.findFirst({ where: { codigoRq, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } });
  if (existe) throw new ErroNegocio(`${codigoRq} já existe.`);
  return prisma.$transaction((tx) =>
    criarAuditado<RqModelo>(tx, ctx, "rqModelo", {
      tenantId: ctx.tenantId,
      popId: pop.id,
      codigoRq,
      titulo: input.titulo?.trim() || codigoRq,
      frequencia: input.frequencia,
      campos: [{ id: "item_1", rotulo: "Item verificado conforme", tipo: "conformidade" }],
      atualizadoPor: ctx.nome,
    }),
  );
}

// ───────────────────────── Instruções de Trabalho ─────────────────────────

export async function itsEfetivas(tenantId: string, popId?: string) {
  const todas = await prisma.instrucaoTrabalho.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }], ...(popId ? { popId } : {}) },
    include: { pop: { select: { numeroPop: true, titulo: true } } },
    orderBy: { codigo: "asc" },
  });
  const proprias = new Set(todas.filter((i) => i.tenantId).map((i) => i.codigo));
  return todas.filter((i) => i.tenantId || !proprias.has(i.codigo));
}

export type ItInput = { titulo: string; objetivo?: string | null; passos: PassoIt[]; ativo: boolean };

export async function salvarIt(ctx: Ctx, itId: string, input: ItInput) {
  const atual = await prisma.instrucaoTrabalho.findFirst({ where: { id: itId, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } });
  if (!atual) throw new ErroNegocio("Instrução não encontrada.");
  const passos = input.passos
    .map((p) => ({ texto: p.texto?.trim(), ...(p.alerta?.trim() ? { alerta: p.alerta.trim() } : {}), ...(p.fotoUrl ? { fotoUrl: p.fotoUrl } : {}) }))
    .filter((p) => p.texto);
  if (!passos.length) throw new ErroNegocio("Inclua pelo menos um passo.");
  if (!input.titulo?.trim()) throw new ErroNegocio("Informe o título.");
  const dados = {
    titulo: input.titulo.trim(),
    objetivo: input.objetivo?.trim() || null,
    passos: passos as unknown as Prisma.InputJsonValue,
    ativo: input.ativo,
    atualizadoPor: ctx.nome,
    versao: atual.versao + 1,
  };
  return prisma.$transaction(async (tx) => {
    if (!atual.tenantId) {
      const propria = await tx.instrucaoTrabalho.findFirst({ where: { tenantId: ctx.tenantId, codigo: atual.codigo } });
      if (propria) throw new ErroNegocio("A empresa já tem versão própria desta IT. Recarregue a página.");
      return criarAuditado<InstrucaoTrabalho>(tx, ctx, "instrucaoTrabalho", { ...dados, tenantId: ctx.tenantId, origemId: atual.id, popId: atual.popId, codigo: atual.codigo }, "PERSONALIZACAO");
    }
    return atualizarAuditado<InstrucaoTrabalho>(tx, ctx, "instrucaoTrabalho", atual.id, dados);
  });
}

export async function criarIt(ctx: Ctx, input: { popId: string; titulo: string }) {
  const pop = await prisma.pop.findUnique({ where: { id: input.popId } });
  if (!pop) throw new ErroNegocio("POP inválido.");
  const prefixo = `IT ${String(pop.numeroPop).padStart(2, "0")}.`;
  const existentes = await prisma.instrucaoTrabalho.findMany({ where: { codigo: { startsWith: prefixo }, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] }, select: { codigo: true } });
  const maior = Math.max(0, ...existentes.map((e) => Number(e.codigo.slice(prefixo.length)) || 0));
  return prisma.$transaction((tx) =>
    criarAuditado<InstrucaoTrabalho>(tx, ctx, "instrucaoTrabalho", {
      tenantId: ctx.tenantId,
      popId: pop.id,
      codigo: `${prefixo}${String(maior + 1).padStart(2, "0")}`,
      titulo: input.titulo?.trim() || "Nova instrução",
      passos: [{ texto: "Descreva o primeiro passo." }],
      atualizadoPor: ctx.nome,
    }),
  );
}
