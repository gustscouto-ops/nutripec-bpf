import type { PrismaClient } from "@prisma/client";
import { CATALOGO_POPS } from "./catalogo";
import { CATALOGO_ITS } from "./instrucoes";

/**
 * Cria/atualiza os POPs, os modelos padrão de RQ e as ITs padrão (tenantId nulo).
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
      const dados = { popId: p.id, titulo: rq.titulo, frequencia: rq.frequencia, campos: rq.campos };
      if (existente) await prisma.rqModelo.update({ where: { id: existente.id }, data: dados });
      else await prisma.rqModelo.create({ data: { ...dados, codigoRq: rq.codigoRq } });
    }
  }
  for (const it of CATALOGO_ITS) {
    const existente = await prisma.instrucaoTrabalho.findFirst({ where: { tenantId: null, codigo: it.codigo } });
    const dados = { popId: pops.get(it.popNumero)!, titulo: it.titulo, objetivo: it.objetivo, passos: it.passos };
    if (existente) await prisma.instrucaoTrabalho.update({ where: { id: existente.id }, data: dados });
    else await prisma.instrucaoTrabalho.create({ data: { ...dados, codigo: it.codigo } });
  }
}
