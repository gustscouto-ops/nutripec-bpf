import { redirect } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { CODIGO_RQ_RECEBIMENTO, MAX_FOTOS, modeloEfetivo, resolverReferencia } from "@/lib/servicos/rq";
import { itsEfetivas } from "@/lib/servicos/modelos";
import { agendada, chaveDia } from "@/lib/agenda";
import type { CampoRq } from "@/lib/rq/campos";
import { ROTULO_FREQUENCIA } from "@/lib/rq/catalogo";
import { Alerta } from "@/components/ui";
import { FormRq } from "./form";

export const metadata = { title: "Registrar RQ" };

export default async function NovoRq({ searchParams }: { searchParams: Promise<{ modelo?: string; ref?: string }> }) {
  const ctx = await exigirCtx();
  const { modelo: modeloId, ref } = await searchParams;
  if (!pode(ctx.perfil, "operacao:registrar")) return <Alerta>Seu perfil não registra RQs.</Alerta>;
  const pedido = modeloId ? await prisma.rqModelo.findFirst({ where: { id: modeloId, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } }) : null;
  if (!pedido) redirect("/tarefas");
  if (pedido.codigoRq === CODIGO_RQ_RECEBIMENTO) redirect("/recebimento/novo");
  const modelo = await modeloEfetivo(ctx.tenantId, pedido.codigoRq);
  if (!modelo?.ativo) return <Alerta>Este RQ está desativado para a empresa.</Alerta>;
  if (modelo.id !== pedido.id) redirect(`/rqs/novo?modelo=${modelo.id}${ref ? `&ref=${ref}` : ""}`);

  let referencia: { rotulo: string; atrasado: boolean; chave: string };
  try {
    const r = resolverReferencia(modelo, ref, new Date());
    referencia = { rotulo: r.periodo.rotulo, atrasado: r.atrasado, chave: ref ?? chaveDia(new Date()) };
  } catch (e) {
    return <Alerta>{(e as Error).message}</Alerta>;
  }
  const its = await itsEfetivas(ctx.tenantId, modelo.popId);

  return (
    <FormRq
      modelo={{ id: modelo.id, codigoRq: modelo.codigoRq, titulo: modelo.titulo, versao: modelo.versao, popNumero: modelo.pop.numeroPop, popTitulo: modelo.pop.titulo, frequencia: ROTULO_FREQUENCIA[modelo.frequencia], agendado: agendada(modelo.frequencia) }}
      campos={modelo.campos as unknown as CampoRq[]}
      referencia={referencia}
      maxFotos={MAX_FOTOS}
      usuario={ctx.nome}
      chaveRascunho={`rascunho-${modelo.codigoRq}-${referencia.chave}-${ctx.tenantId}-${ctx.userId}`}
      its={its.filter((i) => i.ativo).map((i) => ({ id: i.id, codigo: i.codigo, titulo: i.titulo }))}
    />
  );
}

