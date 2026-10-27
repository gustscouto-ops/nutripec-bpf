import { Prisma, type PrismaClient } from "@prisma/client";
import { jsonCanonico } from "../hash";
import { registrarRevisao, resumoAlteracoes } from "../servicos/modelos";
import type { CampoRq } from "./campos";
import { CATALOGO_POPS } from "./catalogo";
import { CATALOGO_ITS } from "./instrucoes";

/**
 * Cria/atualiza os POPs, os modelos padrão de RQ e as ITs padrão (tenantId nulo).
 * Mudança de conteúdo num modelo padrão gera nova revisão no histórico.
 * Versões próprias das empresas nunca são tocadas.
 */
export async function sincronizarCatalogo(prisma: PrismaClient) {
  const pops = new Map<number, string>();
  for (const pop of CATALOGO_POPS) {
    const p = await prisma.pop.upsert({
      where: { numeroPop: pop.numeroPop },
      update: { titulo: pop.titulo, descricaoProcedimento: pop.descricao },
      create: { numeroPop: pop.numeroPop, titulo: pop.titulo, descricaoProcedimento: pop.descricao },
    });
    pops.set(pop.numeroPop, p.id);
    for (const rq of pop.rqs) {
      const existente = await prisma.rqModelo.findFirst({ where: { tenantId: null, codigoRq: rq.codigoRq } });
      const novo = { titulo: rq.titulo, frequencia: rq.frequencia, campos: rq.campos, orientacoes: rq.orientacoes ?? null };
      const dados = { ...novo, popId: p.id, campos: rq.campos as unknown as Prisma.InputJsonValue };
      if (!existente) {
        await prisma.$transaction(async (tx) => {
          const criado = await tx.rqModelo.create({ data: { ...dados, codigoRq: rq.codigoRq } });
          await registrarRevisao(tx, criado, { motivo: "Emissão inicial do modelo padrão", alteracoes: "Formulário criado", userId: null, userNome: "NutriPEC" });
        });
        continue;
      }
      const antes = { titulo: existente.titulo, frequencia: existente.frequencia, campos: existente.campos as unknown as CampoRq[], orientacoes: existente.orientacoes };
      if (jsonCanonico(antes) === jsonCanonico(novo)) {
        if (existente.popId !== p.id) await prisma.rqModelo.update({ where: { id: existente.id }, data: { popId: p.id } });
        continue;
      }
      const extra = { diaSemana: existente.diaSemana, diaMes: existente.diaMes, registrosPorFolha: existente.registrosPorFolha };
      const alteracoes = resumoAlteracoes({ ...antes, ...extra }, { ...novo, ...extra });
      await prisma.$transaction(async (tx) => {
        const atualizado = await tx.rqModelo.update({ where: { id: existente.id }, data: { ...dados, versao: existente.versao + 1, dataRevisao: new Date() } });
        await registrarRevisao(tx, atualizado, {
          motivo: "Atualização do modelo padrão do sistema (requisitos da IN MAPA 04/2007)",
          alteracoes: alteracoes.join("; ") || "Ajuste de texto",
          userId: null,
          userNome: "NutriPEC",
        });
      });
    }
  }
  for (const it of CATALOGO_ITS) {
    const existente = await prisma.instrucaoTrabalho.findFirst({ where: { tenantId: null, codigo: it.codigo } });
    const dados = { popId: pops.get(it.popNumero)!, titulo: it.titulo, objetivo: it.objetivo, passos: it.passos };
    if (existente) await prisma.instrucaoTrabalho.update({ where: { id: existente.id }, data: dados });
    else await prisma.instrucaoTrabalho.create({ data: { ...dados, codigo: it.codigo } });
  }
}
