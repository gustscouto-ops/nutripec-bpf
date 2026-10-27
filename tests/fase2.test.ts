/**
 * Fase 2 contra o PostgreSQL: agenda de tarefas, registro dos RQs dos POPs,
 * tratamento de não conformidades e customização de formulários.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Ctx } from "@/lib/auth";
import { sincronizarCatalogo } from "@/lib/rq/sincronizar";
import { modeloEfetivo, registrarExecucaoRq, tarefas } from "@/lib/servicos/rq";
import { abrirNc, cancelarNc, registrarAcaoExecutada, registrarPlano, verificarEficacia } from "@/lib/servicos/nc";
import { criarModelo, itsEfetivas, salvarIt, salvarModelo } from "@/lib/servicos/modelos";
import { pendencias } from "@/lib/servicos/alertas";

const uid = randomUUID().slice(0, 8);
const AGORA = new Date("2026-10-07T13:00:00Z"); // quarta, 10:00 BRT
let ctx: Ctx;
let outro: Ctx;
const id = async (codigo: string, c = ctx) => (await modeloEfetivo(c.tenantId, codigo))!.id;
const limpeza = {
  piso: { valor: "C" }, moega: { valor: "C" }, misturador: { valor: "C" }, ensaque: { valor: "C" },
  residuos_limpeza: { valor: "C" }, produtos_limpeza: { valor: "C" }, equip_manutencao: { valor: "NA" },
};

async function fabrica(nome: string): Promise<Ctx> {
  const tenant = await prisma.tenant.create({ data: { razaoSocial: `${nome} ${uid}`, cnpj: `${nome}-${uid}`, createdAt: new Date("2026-09-01T12:00:00Z") } });
  const user = await prisma.user.create({ data: { nome: `RT ${nome}`, email: `${nome}-${uid}@teste`, senhaHash: "x" } });
  await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, perfil: "RT" } });
  return { userId: user.id, nome: `RT ${nome}`, tenantId: tenant.id, tenantNome: nome, perfil: "RT", ip: null };
}

beforeAll(async () => {
  await sincronizarCatalogo(prisma);
  ctx = await fabrica("f2a");
  outro = await fabrica("f2b");
});
afterAll(() => prisma.$disconnect());

describe("agenda e registro de RQs", () => {
  it("lista RQs diários atrasados e o de hoje como pendente", async () => {
    const t = await tarefas(ctx.tenantId, AGORA);
    const limpezas = t.atrasadas.filter((x) => x.modelo.codigoRq === "RQ 2.1");
    expect(limpezas).toHaveLength(7); // cobra no máximo 7 dias para trás
    expect(t.pendentes.some((x) => x.modelo.codigoRq === "RQ 2.1" && x.periodo.chave === "2026-10-07")).toBe(true);
    expect(t.quandoOcorre.some((m) => m.codigoRq === "RQ 1.2")).toBe(true);
  });

  it("registra o RQ do dia, assina e tira da lista de pendentes", async () => {
    const { execucao, ncs } = await registrarExecucaoRq(ctx, { modeloId: await id("RQ 2.1"), respostas: limpeza, fotos: [] }, { agora: AGORA });
    expect(execucao.status).toBe("CONFORME");
    expect(execucao.numero).toBe(1);
    expect(execucao.atrasado).toBe(false);
    expect(execucao.hashAssinatura).toHaveLength(64);
    expect(ncs).toHaveLength(0);
    const t = await tarefas(ctx.tenantId, AGORA);
    expect(t.pendentes.some((x) => x.modelo.codigoRq === "RQ 2.1")).toBe(false);
    expect(t.concluidas.some((x) => x.modelo.codigoRq === "RQ 2.1")).toBe(true);
  });

  it("não aceita dois registros do mesmo período", async () => {
    await expect(registrarExecucaoRq(ctx, { modeloId: await id("RQ 2.1"), respostas: limpeza, fotos: [] }, { agora: AGORA })).rejects.toThrow(/já foi registrado/);
  });

  it("registro de dia passado fica marcado como atrasado e numeração segue", async () => {
    const { execucao } = await registrarExecucaoRq(ctx, { modeloId: await id("RQ 2.1"), referencia: "2026-10-06", respostas: limpeza, fotos: [] }, { agora: AGORA });
    expect(execucao.atrasado).toBe(true);
    expect(execucao.numero).toBe(2);
    expect((execucao.cabecalho as { periodo: string }).periodo).toBe("06/10/2026");
  });

  it("recusa período futuro, checklist incompleto e o RQ 1.2 fora do recebimento", async () => {
    await expect(registrarExecucaoRq(ctx, { modeloId: await id("RQ 2.1"), referencia: "2026-10-08", respostas: limpeza, fotos: [] }, { agora: AGORA })).rejects.toThrow(/futuro/);
    await expect(registrarExecucaoRq(ctx, { modeloId: await id("RQ 3.1"), respostas: {}, fotos: [] }, { agora: AGORA })).rejects.toThrow(/incompleto/);
    await expect(registrarExecucaoRq(ctx, { modeloId: await id("RQ 1.2"), respostas: {}, fotos: [] }, { agora: AGORA })).rejects.toThrow(/Recebimento/);
  });

  it("registro assinado não pode ser alterado no banco", async () => {
    const r = await prisma.rqExecucao.findFirstOrThrow({ where: { tenantId: ctx.tenantId, codigoRq: "RQ 2.1" } });
    await expect(prisma.rqExecucao.update({ where: { id: r.id }, data: { campos: [] } })).rejects.toThrow();
    await expect(prisma.rqExecucao.update({ where: { id: r.id }, data: { atrasado: !r.atrasado } })).rejects.toThrow();
  });
});

describe("não conformidades", () => {
  let ncId: string;

  it("item não conforme no RQ abre NC com a ação imediata", async () => {
    const { execucao, ncs } = await registrarExecucaoRq(
      ctx,
      {
        modeloId: await id("RQ 7.1"),
        respostas: {
          iscas_integras: { valor: "C" },
          capturas: { valor: 2, descricaoNc: "Dois roedores no PI-04", acaoCorretiva: "Isca reposta e área isolada" },
          portas_telas: { valor: "C" }, sem_animais: { valor: "C" }, area_externa: { valor: "C" },
        },
        fotos: [],
      },
      { agora: AGORA },
    );
    expect(execucao.status).toBe("NAO_CONFORME");
    expect(ncs).toHaveLength(1);
    expect(ncs[0]).toMatchObject({ numero: 1, origem: "RQ", status: "ABERTA", popNumero: 7, acaoImediata: "Isca reposta e área isolada" });
    ncId = ncs[0].id;
  });

  it("segue o ciclo plano → execução → eficácia, inclusive ação ineficaz", async () => {
    await expect(registrarAcaoExecutada(ctx, ncId, "Feito algo")).rejects.toThrow(/plano/);
    await expect(verificarEficacia(ctx, ncId, true, "Verificado")).rejects.toThrow(/aguardando/);
    await registrarPlano(ctx, ncId, { causaRaiz: "Porta aberta à noite", acaoPreventiva: "Instalar mola na porta", responsavelAcao: "Manutenção", prazo: "2026-10-15" });
    await registrarAcaoExecutada(ctx, ncId, "Mola instalada na porta do galpão");
    const reaberta = await verificarEficacia(ctx, ncId, false, "Nova captura na semana seguinte");
    expect(reaberta.status).toBe("EM_TRATAMENTO");
    expect(reaberta.executadaEm).toBeNull();
    await registrarAcaoExecutada(ctx, ncId, "Tela instalada no vão do telhado");
    const fim = await verificarEficacia(ctx, ncId, true, "Duas semanas sem capturas");
    expect(fim.status).toBe("ENCERRADA");
    expect(fim.hashEncerramento).toHaveLength(64);
    expect(fim.verificacaoEficacia).toBe("Duas semanas sem capturas");
  });

  it("NC encerrada é imutável no banco", async () => {
    await expect(prisma.naoConformidade.update({ where: { id: ncId }, data: { titulo: "x" } })).rejects.toThrow();
    await expect(prisma.naoConformidade.delete({ where: { id: ncId } })).rejects.toThrow();
  });

  it("NC manual numera em sequência e pode ser cancelada com justificativa", async () => {
    const nc = await abrirNc(ctx, { origem: "RECLAMACAO_CLIENTE", titulo: "Ração empedrada", descricao: "Cliente relata sacos empedrados", acaoImediata: "Lote bloqueado no depósito", gravidade: "ALTA" });
    expect(nc.numero).toBe(2);
    await expect(cancelarNc(ctx, nc.id, "")).rejects.toThrow(/justificativa/);
    expect((await cancelarNc(ctx, nc.id, "Aberta em duplicidade")).status).toBe("CANCELADA");
  });

  it("pendências do alerta trazem RQs atrasados", async () => {
    const p = await pendencias(ctx.tenantId, AGORA);
    expect(p.atrasadas.length).toBeGreaterThan(0);
  });
});

describe("customização de formulários e ITs", () => {
  it("primeira edição cria a versão da empresa sem tocar no padrão", async () => {
    const padrao = await modeloEfetivo(ctx.tenantId, "RQ 2.1");
    const campos = [...(padrao!.campos as { id: string; rotulo: string; tipo: string }[]), { rotulo: "Peneira do misturador limpa", tipo: "conformidade" as const }];
    const copia = await salvarModelo(ctx, padrao!.id, { titulo: padrao!.titulo, frequencia: "DIARIA", ativo: true, campos: campos as never });
    expect(copia.tenantId).toBe(ctx.tenantId);
    expect(copia.origemId).toBe(padrao!.id);
    expect(copia.versao).toBe(padrao!.versao + 1);
    expect((copia.campos as { id: string }[]).at(-1)!.id).toBe("peneira_do_misturador_limpa");
    expect((await modeloEfetivo(ctx.tenantId, "RQ 2.1"))!.id).toBe(copia.id);
    expect((await modeloEfetivo(outro.tenantId, "RQ 2.1"))!.id).toBe(padrao!.id); // outra fábrica continua no padrão
    // registros antigos guardam os campos da época
    const antigo = await prisma.rqExecucao.findFirstOrThrow({ where: { tenantId: ctx.tenantId, codigoRq: "RQ 2.1" } });
    expect((antigo.campos as unknown[]).length).toBe((padrao!.campos as unknown[]).length);
  });

  it("formulário desatualizado na tela é recusado", async () => {
    const padrao = await prisma.rqModelo.findFirstOrThrow({ where: { tenantId: null, codigoRq: "RQ 2.1" } });
    await expect(registrarExecucaoRq(ctx, { modeloId: padrao.id, referencia: "2026-10-05", respostas: limpeza, fotos: [] }, { agora: AGORA })).rejects.toThrow(/atualizado/);
  });

  it("desativar o RQ tira ele da agenda", async () => {
    const m = (await modeloEfetivo(ctx.tenantId, "RQ 2.1"))!;
    const salvo = await salvarModelo(ctx, m.id, { titulo: m.titulo, frequencia: "DIARIA", ativo: false, campos: m.campos as never });
    expect(salvo.versao).toBe(m.versao); // campos iguais não sobem versão
    const t = await tarefas(ctx.tenantId, AGORA);
    expect(t.atrasadas.some((x) => x.modelo.codigoRq === "RQ 2.1")).toBe(false);
  });

  it("valida regras do customizador", async () => {
    const rq12 = await modeloEfetivo(ctx.tenantId, "RQ 1.2");
    await expect(salvarModelo(ctx, rq12!.id, { titulo: "x", frequencia: "DIARIA", ativo: true, campos: rq12!.campos as never })).rejects.toThrow(/quando ocorre/);
    await expect(salvarModelo(ctx, rq12!.id, { titulo: "x", frequencia: "QUANDO_OCORRE", ativo: true, campos: [] })).rejects.toThrow(/pelo menos um item/);
    const pop2 = await prisma.pop.findUniqueOrThrow({ where: { numeroPop: 2 } });
    await expect(criarModelo(ctx, { popId: pop2.id, codigoRq: "RQ 3.9", titulo: "x", frequencia: "MENSAL" })).rejects.toThrow(/RQ 2/);
    const novo = await criarModelo(ctx, { popId: pop2.id, codigoRq: "rq 2.9", titulo: "Limpeza do silo", frequencia: "MENSAL" });
    expect(novo.codigoRq).toBe("RQ 2.9");
    await expect(criarModelo(ctx, { popId: pop2.id, codigoRq: "RQ 2.9", titulo: "x", frequencia: "MENSAL" })).rejects.toThrow(/já existe/);
  });

  it("IT editada vira versão da empresa", async () => {
    const [it01] = await itsEfetivas(ctx.tenantId);
    const propria = await salvarIt(ctx, it01.id, { titulo: it01.titulo, objetivo: it01.objetivo, ativo: true, passos: [{ texto: "Passo único" }, { texto: "  " }] });
    expect(propria.tenantId).toBe(ctx.tenantId);
    expect(propria.passos).toEqual([{ texto: "Passo único" }]);
    const efetivas = await itsEfetivas(ctx.tenantId);
    expect(efetivas.filter((i) => i.codigo === it01.codigo).map((i) => i.id)).toEqual([propria.id]);
  });
});
