import { Prisma, type RqExecucao, type RqModelo, type Pop } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { registrarAuditoria } from "../audit";
import { ErroNegocio } from "../erros";
import { hashAssinatura, sha256 } from "../hash";
import { agendada, chaveDia, deChave, periodoAnterior, periodoDe, periodoDoDia, periodosCobrados, type Periodo } from "../agenda";
import { avaliarRespostas, type CampoRq, type Respostas, type ResultadoAvaliacao } from "../rq/campos";
import { salvarArquivo } from "../storage";
import type { Ctx } from "../auth";

/**
 * Motor de execução dos RQs (POPs 01 a 09): modelos efetivos por empresa, agenda de tarefas,
 * assinatura e abertura automática de não conformidades.
 */

export { CODIGO_RQ_RECEBIMENTO } from "../rq/codigos";
import { CODIGO_RQ_RECEBIMENTO } from "../rq/codigos";
export const MAX_FOTOS = 5;
const MAX_BYTES_FOTO = 8 * 1024 * 1024;
const TIPOS_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type FotoEntrada = { conteudo: Buffer; mimeType: string; descricao?: string };
export type ModeloComPop = RqModelo & { pop: Pop };

/** Modelos vigentes para a empresa: a versão própria (customizada) substitui a padrão do mesmo código. */
export async function modelosEfetivos(tenantId: string, opcoes: { incluirInativos?: boolean } = {}): Promise<ModeloComPop[]> {
  const todos = await prisma.rqModelo.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }] },
    include: { pop: true },
    orderBy: [{ pop: { numeroPop: "asc" } }, { codigoRq: "asc" }],
  });
  const proprios = new Set(todos.filter((m) => m.tenantId).map((m) => m.codigoRq));
  return todos
    .filter((m) => m.tenantId || !proprios.has(m.codigoRq))
    .filter((m) => opcoes.incluirInativos || m.ativo)
    .sort((a, b) => a.pop.numeroPop - b.pop.numeroPop || a.codigoRq.localeCompare(b.codigoRq, "pt-BR", { numeric: true }));
}

export async function modeloEfetivo(tenantId: string, codigoRq: string, db: Tx = prisma) {
  return (
    (await db.rqModelo.findFirst({ where: { tenantId, codigoRq }, include: { pop: true } })) ??
    (await db.rqModelo.findFirst({ where: { tenantId: null, codigoRq }, include: { pop: true } }))
  );
}

/** Serializa numeração e checagem de período por empresa + RQ (evita duplicidade em registros simultâneos). */
export async function travarRq(tx: Tx, tenantId: string, codigoRq: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}|${codigoRq}`}))`;
}

export async function proximoNumero(tx: Tx, tenantId: string, codigoRq: string) {
  const ultimo = await tx.rqExecucao.aggregate({ where: { tenantId, codigoRq }, _max: { numero: true } });
  return (ultimo._max.numero ?? 0) + 1;
}

export function validarFotos(fotos: FotoEntrada[]) {
  if (fotos.length > MAX_FOTOS) throw new ErroNegocio(`Envie no máximo ${MAX_FOTOS} fotos.`);
  for (const f of fotos) {
    if (!TIPOS_FOTO[f.mimeType]) throw new ErroNegocio("Formato de foto não suportado (use JPG, PNG ou WEBP).");
    if (f.conteudo.length > MAX_BYTES_FOTO) throw new ErroNegocio("Foto acima de 8 MB.");
  }
}

export async function gravarFotos(tenantId: string, fotos: FotoEntrada[]) {
  validarFotos(fotos);
  return Promise.all(
    fotos.map(async (f) => ({
      fotoUrl: await salvarArquivo(tenantId, f.conteudo, TIPOS_FOTO[f.mimeType]),
      mimeType: f.mimeType,
      descricao: f.descricao?.slice(0, 200) || null,
      hashArquivo: sha256(f.conteudo),
    })),
  );
}

/** Abre uma NC para cada item não conforme do RQ (com a ação imediata registrada pelo operador). */
export async function abrirNcsDaExecucao(
  tx: Tx,
  ctx: Ctx,
  execucao: RqExecucao,
  modelo: ModeloComPop,
  avaliacao: ResultadoAvaliacao,
  extra: { fornecedorId?: string; loteReferencia?: string; prefixoTitulo?: string } = {},
) {
  if (!avaliacao.naoConformidades.length) return [];
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.tenantId}|NC`}))`;
  const ultimo = await tx.naoConformidade.aggregate({ where: { tenantId: ctx.tenantId }, _max: { numero: true } });
  let numero = ultimo._max.numero ?? 0;
  const criadas = [];
  for (const nc of avaliacao.naoConformidades) {
    const criada = await tx.naoConformidade.create({
      data: {
        tenantId: ctx.tenantId,
        numero: ++numero,
        origem: "RQ",
        rqExecucaoId: execucao.id,
        campoId: nc.campoId,
        popNumero: modelo.pop.numeroPop,
        fornecedorId: extra.fornecedorId ?? null,
        loteReferencia: extra.loteReferencia ?? null,
        titulo: `${modelo.codigoRq} — ${extra.prefixoTitulo ? `${extra.prefixoTitulo}: ` : ""}${nc.rotulo}`.slice(0, 250),
        descricao: nc.descricaoNc,
        acaoImediata: nc.acaoCorretiva,
        abertaPorId: ctx.userId,
        abertaPorNome: ctx.nome,
      },
    });
    await registrarAuditoria(tx, ctx, { tabela: "naoConformidade", registroId: criada.id, acao: "CREATE", depois: criada });
    criadas.push(criada);
  }
  return criadas;
}

export type ExecucaoInput = {
  modeloId: string;
  referencia?: string | null; // AAAA-MM-DD de um dia do período a que o registro se refere
  respostas: Respostas;
  observacoes?: string | null;
  fotos: FotoEntrada[];
};

/** Resolve o período de referência e se o preenchimento está atrasado. */
export function resolverReferencia(modelo: Pick<RqModelo, "frequencia" | "diaSemana" | "diaMes">, referencia: string | null | undefined, agora: Date) {
  const base = referencia ? deChave(referencia) : agora;
  if (base.getTime() > agora.getTime()) throw new ErroNegocio("Não é possível registrar um período futuro.");
  if (!agendada(modelo.frequencia)) {
    return { periodo: periodoDoDia(base), atrasado: false };
  }
  const periodo = periodoDe(modelo.frequencia, base, modelo)!;
  return { periodo, atrasado: periodo.vencimento.getTime() <= agora.getTime() };
}

/** Registro assinado de qualquer RQ (exceto o RQ 1.2, que tem fluxo próprio de recebimento). */
/** Registra e assina um RQ. Com `opcoes.tx`, roda dentro da transação de quem chama (ex.: simulado de recall). */
export async function registrarExecucaoRq(ctx: Ctx, input: ExecucaoInput, opcoes: { agora?: Date; tx?: Tx } = {}) {
  const modelo = await prisma.rqModelo.findFirst({
    where: { id: input.modeloId, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] },
    include: { pop: true },
  });
  if (!modelo || !modelo.ativo) throw new ErroNegocio("RQ não encontrado ou inativo.");
  if (modelo.codigoRq === CODIGO_RQ_RECEBIMENTO) throw new ErroNegocio("O RQ 1.2 é registrado pela tela de Recebimento.");
  const vigente = await modeloEfetivo(ctx.tenantId, modelo.codigoRq);
  if (vigente?.id !== modelo.id) throw new ErroNegocio("Este formulário foi atualizado. Recarregue a página para usar a versão vigente.");

  const agora = opcoes.agora ?? new Date(); // "agora" só é injetado pelo seed de demonstração
  const { periodo, atrasado } = resolverReferencia(modelo, input.referencia, agora);
  const campos = modelo.campos as unknown as CampoRq[];
  const avaliacao = avaliarRespostas(campos, input.respostas ?? {});
  if (Object.keys(avaliacao.erros).length) throw new ErroNegocio("Checklist incompleto. Revise os itens destacados.", avaliacao.erros);
  const fotos = await gravarFotos(ctx.tenantId, input.fotos);

  const corpo = async (tx: Tx) => {
    await travarRq(tx, ctx.tenantId, modelo.codigoRq);
    if (agendada(modelo.frequencia)) {
      const existente = await tx.rqExecucao.findFirst({ where: { tenantId: ctx.tenantId, codigoRq: modelo.codigoRq, referenciaInicio: periodo.inicio } });
      if (existente) throw new ErroNegocio(`O ${modelo.codigoRq} de ${periodo.rotulo} já foi registrado (nº ${String(existente.numero).padStart(4, "0")}).`);
    }
    const numero = await proximoNumero(tx, ctx.tenantId, modelo.codigoRq);
    const observacoes = input.observacoes?.trim() || null;
    const hash = hashAssinatura({
      tenantId: ctx.tenantId,
      rq: modelo.codigoRq,
      versaoModelo: modelo.versao,
      campos,
      numero,
      dataHora: agora.toISOString(),
      referencia: { inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString(), atrasado },
      assinante: { id: ctx.userId, nome: ctx.nome, perfil: ctx.perfil },
      status: avaliacao.status,
      respostas: avaliacao.respostas,
      observacoes,
      fotos: fotos.map((f) => f.hashArquivo),
    });
    const execucao = await tx.rqExecucao.create({
      data: {
        tenantId: ctx.tenantId,
        rqModeloId: modelo.id,
        codigoRq: modelo.codigoRq,
        versaoModelo: modelo.versao,
        campos: campos as unknown as Prisma.InputJsonValue,
        numero,
        referenciaInicio: periodo.inicio,
        referenciaFim: periodo.fim,
        atrasado,
        userIdAssinatura: ctx.userId,
        nomeAssinatura: ctx.nome,
        perfilAssinatura: ctx.perfil,
        dataHoraExecucao: agora,
        status: avaliacao.status,
        respostas: avaliacao.respostas as Prisma.InputJsonValue,
        cabecalho: { periodo: periodo.rotulo } as Prisma.InputJsonValue,
        observacoes,
        hashAssinatura: hash,
        ipOrigem: ctx.ip,
        fotos: { create: fotos },
      },
    });
    await tx.rqExecucao.update({ where: { id: execucao.id }, data: { pdfUrl: `/api/rq/${execucao.id}/pdf` } });
    await registrarAuditoria(tx, ctx, { tabela: "rqExecucao", registroId: execucao.id, acao: "ASSINATURA", depois: { ...execucao, fotos } });
    const ncs = await abrirNcsDaExecucao(tx, ctx, execucao, modelo, avaliacao);
    return { execucao, ncs };
  };
  return opcoes.tx ? corpo(opcoes.tx) : prisma.$transaction(corpo);
}

// ───────────────────────── Agenda / lista de tarefas ─────────────────────────

export type Tarefa = {
  modelo: { id: string; codigoRq: string; titulo: string; popNumero: number; frequencia: RqModelo["frequencia"] };
  periodo: Periodo;
  status: "ATRASADA" | "PENDENTE" | "CONCLUIDA";
  execucao?: { id: string; numero: number; status: string; nomeAssinatura: string; atrasado: boolean };
};

/**
 * Tarefas do dia calculadas a partir da frequência de cada RQ (sem tabela de agenda para manter):
 * período atual pendente, períodos anteriores não preenchidos (atrasados) e concluídos.
 */
export async function tarefas(tenantId: string, agora = new Date()) {
  const [modelos, tenant] = await Promise.all([modelosEfetivos(tenantId), prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })]);
  const agendados = modelos.filter((m) => agendada(m.frequencia));
  const quandoOcorre = modelos.filter((m) => !agendada(m.frequencia));

  const periodosPorModelo = agendados.map((m) => {
    const atual = periodoDe(m.frequencia, agora, m)!;
    const lista = [atual];
    let p = atual;
    for (let i = 0; i < periodosCobrados(m.frequencia); i++) {
      p = periodoAnterior(m.frequencia, p, m);
      if (p.fim.getTime() <= tenant.createdAt.getTime()) break; // a empresa ainda não usava o sistema
      lista.push(p);
    }
    return { m, lista };
  });
  const maisAntigo = Math.min(...periodosPorModelo.flatMap((x) => x.lista.map((p) => p.inicio.getTime())), agora.getTime());
  const execucoes = await prisma.rqExecucao.findMany({
    where: { tenantId, codigoRq: { in: agendados.map((m) => m.codigoRq) }, referenciaInicio: { gte: new Date(maisAntigo) } },
    select: { id: true, codigoRq: true, numero: true, status: true, nomeAssinatura: true, atrasado: true, referenciaInicio: true },
  });
  const feitas = new Map(execucoes.map((e) => [`${e.codigoRq}|${e.referenciaInicio!.toISOString()}`, e]));

  const lista: Tarefa[] = [];
  for (const { m, lista: periodos } of periodosPorModelo) {
    for (const periodo of periodos) {
      const e = feitas.get(`${m.codigoRq}|${periodo.inicio.toISOString()}`);
      const vencido = periodo.vencimento.getTime() <= agora.getTime();
      lista.push({
        modelo: { id: m.id, codigoRq: m.codigoRq, titulo: m.titulo, popNumero: m.pop.numeroPop, frequencia: m.frequencia },
        periodo,
        status: e ? "CONCLUIDA" : vencido ? "ATRASADA" : "PENDENTE",
        execucao: e ? { id: e.id, numero: e.numero, status: e.status, nomeAssinatura: e.nomeAssinatura, atrasado: e.atrasado } : undefined,
      });
    }
  }
  const atuais = new Set(periodosPorModelo.map(({ m, lista: l }) => `${m.codigoRq}|${l[0].chave}`));
  return {
    atrasadas: lista.filter((t) => t.status === "ATRASADA").sort((a, b) => a.periodo.inicio.getTime() - b.periodo.inicio.getTime()),
    pendentes: lista.filter((t) => t.status === "PENDENTE").sort((a, b) => a.periodo.vencimento.getTime() - b.periodo.vencimento.getTime()),
    concluidas: lista.filter((t) => t.status === "CONCLUIDA" && atuais.has(`${t.modelo.codigoRq}|${t.periodo.chave}`)),
    quandoOcorre: quandoOcorre.map((m) => ({ id: m.id, codigoRq: m.codigoRq, titulo: m.titulo, popNumero: m.pop.numeroPop })),
    hoje: chaveDia(agora),
  };
}
