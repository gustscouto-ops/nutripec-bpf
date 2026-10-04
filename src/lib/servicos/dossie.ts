import { prisma } from "../db";
import { ErroNegocio } from "../erros";
import { agendada, deChave, periodoDe } from "../agenda";
import { modelosEfetivos } from "./rq";

/**
 * Dossiê de fiscalização ("Preparar Auditoria MAPA"): resumo por POP e cobertura da agenda no período.
 * Cobertura = períodos vencidos dentro do intervalo que têm registro assinado. Usa a frequência vigente de
 * cada RQ e ignora o período anterior ao cadastro da empresa.
 */

export const MAX_DIAS_DOSSIE = 366;

export function intervalo(inicio: string, fim: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) throw new ErroNegocio("Informe as datas inicial e final.");
  const de = deChave(inicio);
  const ate = new Date(deChave(fim).getTime() + 86_400_000); // exclusivo
  if (ate <= de) throw new ErroNegocio("A data final deve ser igual ou posterior à inicial.");
  if ((ate.getTime() - de.getTime()) / 86_400_000 > MAX_DIAS_DOSSIE) throw new ErroNegocio(`O dossiê cobre no máximo ${MAX_DIAS_DOSSIE} dias por pacote.`);
  return { de, ate };
}

export type LinhaRq = {
  codigoRq: string;
  titulo: string;
  frequencia: string;
  esperados: number | null; // null = "quando ocorre"
  cobertos: number;
  registros: number;
  conformes: number;
  atrasados: number;
};

export type ResumoDossie = {
  de: Date;
  ate: Date;
  pops: { numero: number; titulo: string; rqs: LinhaRq[]; registros: number; conformes: number }[];
  ncs: { abertas: number; encerradas: number; canceladas: number; total: number };
  recalls: number;
  cobertura: number | null; // % dos períodos vencidos com registro
  totalRegistros: number;
};

export async function resumoDossie(tenantId: string, de: Date, ate: Date, agora = new Date()): Promise<ResumoDossie> {
  const [tenant, pops, modelos, execucoes, ncs, recalls] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.pop.findMany({ orderBy: { numeroPop: "asc" } }),
    modelosEfetivos(tenantId, { incluirInativos: true }),
    prisma.rqExecucao.findMany({
      where: { tenantId, dataHoraExecucao: { gte: de, lt: ate } },
      select: { codigoRq: true, status: true, atrasado: true, referenciaInicio: true },
    }),
    prisma.naoConformidade.groupBy({ by: ["status"], where: { tenantId, abertaEm: { gte: de, lt: ate } }, _count: true }),
    prisma.recallRegistro.count({ where: { tenantId, concluidoEm: { gte: de, lt: ate } } }),
  ]);
  // registros que cobrem períodos do intervalo, mesmo assinados depois (atrasados)
  const referencias = await prisma.rqExecucao.findMany({
    where: { tenantId, referenciaInicio: { gte: new Date(de.getTime() - 366 * 86_400_000), lt: ate } },
    select: { codigoRq: true, referenciaInicio: true },
  });
  const feitos = new Set(referencias.map((r) => `${r.codigoRq}|${r.referenciaInicio!.toISOString()}`));
  const limite = new Date(Math.min(ate.getTime(), agora.getTime()));
  const comeco = new Date(Math.max(de.getTime(), tenant.createdAt.getTime()));

  let esperadosTotal = 0;
  let cobertosTotal = 0;
  const linhas: (LinhaRq & { popId: string })[] = modelos.map((m) => {
    const doRq = execucoes.filter((e) => e.codigoRq === m.codigoRq);
    let esperados: number | null = null;
    let cobertos = 0;
    if (agendada(m.frequencia) && m.ativo) {
      esperados = 0;
      let p = periodoDe(m.frequencia, comeco, m)!;
      for (let guarda = 0; guarda < 400 && p.inicio < limite; guarda++) {
        if (p.vencimento <= limite && p.fim > comeco) {
          esperados++;
          if (feitos.has(`${m.codigoRq}|${p.inicio.toISOString()}`)) cobertos++;
        }
        p = periodoDe(m.frequencia, p.fim, m)!;
      }
      esperadosTotal += esperados;
      cobertosTotal += cobertos;
    }
    return {
      popId: m.popId,
      codigoRq: m.codigoRq,
      titulo: m.titulo,
      frequencia: m.frequencia,
      esperados,
      cobertos,
      registros: doRq.length,
      conformes: doRq.filter((e) => e.status === "CONFORME").length,
      atrasados: doRq.filter((e) => e.atrasado).length,
    };
  });

  const contaNc = (s: string) => ncs.find((n) => n.status === s)?._count ?? 0;
  return {
    de,
    ate,
    pops: pops.map((p) => {
      const rqs = linhas.filter((l) => l.popId === p.id).map(({ popId: _, ...l }) => l);
      return { numero: p.numeroPop, titulo: p.titulo, rqs, registros: rqs.reduce((s, r) => s + r.registros, 0), conformes: rqs.reduce((s, r) => s + r.conformes, 0) };
    }),
    ncs: {
      abertas: contaNc("ABERTA") + contaNc("EM_TRATAMENTO") + contaNc("AGUARDANDO_VERIFICACAO"),
      encerradas: contaNc("ENCERRADA"),
      canceladas: contaNc("CANCELADA"),
      total: ncs.reduce((s, n) => s + n._count, 0),
    },
    recalls,
    cobertura: esperadosTotal ? Math.round((cobertosTotal / esperadosTotal) * 1000) / 10 : null,
    totalRegistros: execucoes.length,
  };
}
