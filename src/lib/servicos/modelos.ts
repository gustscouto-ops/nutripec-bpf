import { Prisma, type Frequencia, type InstrucaoTrabalho, type RqModelo, type RqModeloRevisao } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { atualizarAuditado, criarAuditado, registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura, jsonCanonico } from "../hash";
import { padraoDoCampo } from "../rq/campos";
import { ROTULO_FREQUENCIA } from "../rq/catalogo";
import type { CampoRq } from "../rq/campos";
import type { PassoIt } from "../rq/instrucoes";
import type { Ctx } from "../auth";
import { CODIGO_RQ_RECEBIMENTO } from "./rq";

/**
 * Customizador de formulários e de ITs. Modelos padrão (tenantId nulo) nunca são alterados pela empresa:
 * a primeira edição cria a versão própria da empresa, e cada alteração de conteúdo gera uma nova revisão
 * (número, data, motivo e resumo do que mudou), guardada no histórico imutável rq_modelo_revisoes.
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
    if (c.padrao?.trim()) campo.padrao = c.padrao.trim();
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

export type ModeloInput = {
  titulo: string;
  frequencia: Frequencia;
  diaSemana?: number | null;
  diaMes?: number | null;
  ativo: boolean;
  campos: Partial<CampoRq>[];
  orientacoes?: string | null;
  registrosPorFolha?: number | null;
  /** Motivo da alteração impresso no histórico de revisões. */
  motivo?: string | null;
  /** Número da revisão (ex.: 7 para continuar a numeração do formulário em papel). Padrão: a atual + 1. */
  revisao?: number | null;
  /** Data da revisão (AAAA-MM-DD). Padrão: agora. */
  dataRevisao?: string | null;
};

type ConteudoModelo = Pick<RqModelo, "titulo" | "frequencia" | "diaSemana" | "diaMes" | "orientacoes" | "registrosPorFolha"> & { campos: CampoRq[] };

const conteudo = (m: Omit<ConteudoModelo, "campos"> & { campos: unknown }): ConteudoModelo => ({
  titulo: m.titulo,
  frequencia: m.frequencia,
  diaSemana: m.diaSemana ?? null,
  diaMes: m.diaMes ?? null,
  orientacoes: m.orientacoes?.trim() || null,
  registrosPorFolha: m.registrosPorFolha ?? null,
  campos: m.campos as CampoRq[],
});

/** Resumo legível do que mudou entre duas revisões de um RQ (vai para o histórico de revisões). */
export function resumoAlteracoes(antes: ConteudoModelo, depois: ConteudoModelo): string[] {
  const mudancas: string[] = [];
  if (antes.titulo !== depois.titulo) mudancas.push(`Título: "${antes.titulo}" para "${depois.titulo}"`);
  if (antes.frequencia !== depois.frequencia) mudancas.push(`Frequência: ${ROTULO_FREQUENCIA[antes.frequencia]} para ${ROTULO_FREQUENCIA[depois.frequencia]}`);
  else if (antes.diaSemana !== depois.diaSemana || antes.diaMes !== depois.diaMes) mudancas.push("Prazo de preenchimento alterado");
  if (antes.orientacoes !== depois.orientacoes) mudancas.push(depois.orientacoes ? "Orientações (OBS) do formulário alteradas" : "Orientações (OBS) removidas");
  if (antes.registrosPorFolha !== depois.registrosPorFolha) mudancas.push("Registros por folha do modelo impresso alterados");
  const porId = new Map(antes.campos.map((c) => [c.id, c]));
  const novosIds = new Set(depois.campos.map((c) => c.id));
  for (const c of depois.campos) {
    const velho = porId.get(c.id);
    if (!velho) mudancas.push(`Item incluído: ${c.rotulo}`);
    else if (velho.rotulo !== c.rotulo) mudancas.push(`Item alterado: "${velho.rotulo}" para "${c.rotulo}"`);
    else if (velho.tipo !== c.tipo || padraoDoCampo(velho) !== padraoDoCampo(c) || (velho.obrigatorio !== false) !== (c.obrigatorio !== false) || velho.ajuda !== c.ajuda)
      mudancas.push(`Item alterado (padrão, tipo ou orientação): ${c.rotulo}`);
  }
  for (const c of antes.campos) if (!novosIds.has(c.id)) mudancas.push(`Item excluído: ${c.rotulo}`);
  const ordemAntes = antes.campos.map((c) => c.id).filter((i) => novosIds.has(i));
  const ordemDepois = depois.campos.map((c) => c.id).filter((i) => porId.has(i));
  if (ordemAntes.join() !== ordemDepois.join()) mudancas.push("Ordem dos itens alterada");
  return mudancas;
}

/** Grava uma revisão no histórico imutável, com hash do conteúdo aprovado. */
export async function registrarRevisao(
  tx: Tx,
  modelo: RqModelo,
  dados: { motivo: string; alteracoes: string; userId: string | null; userNome: string },
): Promise<RqModeloRevisao> {
  const base = {
    tenantId: modelo.tenantId,
    rqModeloId: modelo.id,
    codigoRq: modelo.codigoRq,
    revisao: modelo.versao,
    dataRevisao: modelo.dataRevisao,
    motivo: dados.motivo,
    alteracoes: dados.alteracoes,
    titulo: modelo.titulo,
    frequencia: modelo.frequencia,
    campos: modelo.campos as Prisma.InputJsonValue,
    orientacoes: modelo.orientacoes,
    userId: dados.userId,
    userNome: dados.userNome,
  };
  return tx.rqModeloRevisao.create({ data: { ...base, hash: hashAssinatura({ ...base, dataRevisao: base.dataRevisao.toISOString() }) } });
}

/** Revisões de um RQ (da empresa e, antes da personalização, do modelo padrão), da mais recente para a mais antiga. */
export async function historicoRevisoes(tenantId: string, codigoRq: string) {
  const todas = await prisma.rqModeloRevisao.findMany({
    where: { codigoRq, OR: [{ tenantId }, { tenantId: null }] },
    orderBy: [{ revisao: "desc" }, { createdAt: "desc" }],
  });
  // depois que a empresa personaliza, revisões posteriores do modelo padrão não se aplicam a ela
  const proprias = todas.filter((r) => r.tenantId);
  if (!proprias.length) return todas;
  const inicio = Math.min(...proprias.map((r) => r.createdAt.getTime()));
  return todas.filter((r) => r.tenantId || r.createdAt.getTime() <= inicio);
}

/** Revisão em que um registro foi assinado (para o cabeçalho do PDF): a da empresa ou, se não houver, a do padrão. */
export async function revisaoDoRegistro(tenantId: string, codigoRq: string, revisao: number) {
  return (
    (await prisma.rqModeloRevisao.findFirst({ where: { tenantId, codigoRq, revisao }, orderBy: { createdAt: "desc" } })) ??
    (await prisma.rqModeloRevisao.findFirst({ where: { tenantId: null, codigoRq, revisao }, orderBy: { createdAt: "desc" } }))
  );
}

function dataDaRevisao(entrada: string | null | undefined, agora: Date) {
  if (!entrada) return agora;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada)) throw new ErroNegocio("Data da revisão inválida.");
  const d = new Date(`${entrada}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new ErroNegocio("Data da revisão inválida.");
  if (d.getTime() > agora.getTime() + 24 * 3600_000) throw new ErroNegocio("A data da revisão não pode ser futura.");
  return d;
}

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
  const porFolha = input.registrosPorFolha === undefined || input.registrosPorFolha === null || (input.registrosPorFolha as unknown) === "" ? null : Number(input.registrosPorFolha);
  if (porFolha !== null && (!Number.isInteger(porFolha) || porFolha < 1 || porFolha > 12)) throw new ErroNegocio("Registros por folha: de 1 a 12.");
  const campos = normalizarCampos(input.campos);
  const dados = {
    titulo,
    frequencia: input.frequencia,
    diaSemana: input.frequencia === "SEMANAL" || input.frequencia === "QUINZENAL" ? (input.diaSemana ?? null) : null,
    diaMes: ["MENSAL", "SEMESTRAL", "ANUAL"].includes(input.frequencia) ? (input.diaMes ?? null) : null,
    ativo: input.ativo,
    campos: campos as unknown as Prisma.InputJsonValue,
    orientacoes: input.orientacoes?.trim() || null,
    registrosPorFolha: porFolha,
    atualizadoPor: ctx.nome,
  };
  // jsonb não preserva a ordem das chaves: a comparação usa o JSON canônico
  const alteracoes = resumoAlteracoes(conteudo(atual), conteudo({ ...dados, campos }));
  const mudou = jsonCanonico(conteudo(atual)) !== jsonCanonico(conteudo({ ...dados, campos }));
  const informada = input.revisao === undefined || input.revisao === null || (input.revisao as unknown) === "" ? null : Number(input.revisao);
  if (informada !== null && (!Number.isInteger(informada) || informada < 0 || informada > 999)) throw new ErroNegocio("Número de revisão inválido.");
  const novaRevisao = !atual.tenantId || mudou || (informada !== null && informada !== atual.versao);
  if (novaRevisao && informada !== null && informada <= atual.versao) {
    throw new ErroNegocio(`A nova revisão precisa ser maior que a atual (${String(atual.versao).padStart(2, "0")}).`);
  }
  const agora = new Date();
  const revisao = novaRevisao ? { versao: informada ?? atual.versao + 1, dataRevisao: dataDaRevisao(input.dataRevisao, agora) } : {};
  const motivo = input.motivo?.trim() || (atual.tenantId ? "Alteração do formulário" : "Adaptação do modelo padrão à realidade da fábrica");
  const resumo = alteracoes.length ? alteracoes.join("; ") : informada !== null ? "Renumeração da revisão, sem mudança de conteúdo" : "Sem mudança de conteúdo";

  return prisma.$transaction(async (tx) => {
    const salvo = !atual.tenantId
      ? await criarAuditado<RqModelo>(
          tx,
          ctx,
          "rqModelo",
          { ...dados, ...revisao, tenantId: ctx.tenantId, origemId: atual.id, popId: atual.popId, codigoRq: atual.codigoRq },
          "PERSONALIZACAO",
        )
      : await atualizarAuditado<RqModelo>(tx, ctx, "rqModelo", atual.id, { ...dados, ...revisao });
    if (novaRevisao) {
      const r = await registrarRevisao(tx, salvo, { motivo, alteracoes: resumo, userId: ctx.userId, userNome: ctx.nome });
      await registrarAuditoria(tx, ctx, { tabela: "rqModeloRevisao", registroId: r.id, acao: "REVISAO", depois: r });
    }
    return salvo;
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
  if (!FREQUENCIAS.includes(input.frequencia)) throw new ErroNegocio("Frequência inválida.");
  return prisma.$transaction(async (tx) => {
    const novo = await criarAuditado<RqModelo>(tx, ctx, "rqModelo", {
      tenantId: ctx.tenantId,
      popId: pop.id,
      codigoRq,
      titulo: input.titulo?.trim() || codigoRq,
      frequencia: input.frequencia,
      campos: [{ id: "item_1", rotulo: "Item verificado conforme", tipo: "conformidade" }],
      atualizadoPor: ctx.nome,
    });
    await registrarRevisao(tx, novo, { motivo: "Emissão inicial", alteracoes: "Formulário criado", userId: ctx.userId, userNome: ctx.nome });
    return novo;
  });
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
