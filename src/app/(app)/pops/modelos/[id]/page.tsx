import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { CODIGO_RQ_RECEBIMENTO, modeloEfetivo } from "@/lib/servicos/rq";
import type { CampoRq } from "@/lib/rq/campos";
import { Alerta, Cabecalho } from "@/components/ui";
import { EditorModelo } from "./editor";

export const metadata = { title: "Personalizar RQ" };

export default async function PersonalizarModelo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "formulario:customizar")) return <Alerta>Somente o RT ou o consultor personalizam formulários.</Alerta>;
  const { id } = await params;
  const { salvo } = await searchParams;
  const pedido = await prisma.rqModelo.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] } });
  if (!pedido) notFound();
  const modelo = await modeloEfetivo(ctx.tenantId, pedido.codigoRq);
  if (!modelo) notFound();
  if (modelo.id !== pedido.id) redirect(`/pops/modelos/${modelo.id}`);
  const registros = await prisma.rqExecucao.count({ where: { tenantId: ctx.tenantId, codigoRq: modelo.codigoRq } });
  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho
        titulo={`${modelo.codigoRq} — personalizar formulário`}
        subtitulo={
          <>
            POP {String(modelo.pop.numeroPop).padStart(2, "0")} · {modelo.pop.titulo} · versão atual v{modelo.versao}
            {modelo.tenantId ? ` (versão da empresa, por ${modelo.atualizadoPor ?? "—"})` : " (padrão do sistema)"}
          </>
        }
        acoes={
          <Link href="/pops" className="btn-secundario">
            Voltar
          </Link>
        }
      />
      <div className="mb-4">
        <Alerta tipo="info">
          {registros} registro(s) já assinado(s) guardam a versão do formulário em que foram feitos e não mudam. Alterar os itens gera a versão v{modelo.versao + 1}, usada nos próximos
          preenchimentos.
        </Alerta>
      </div>
      <EditorModelo
        id={modelo.id}
        recebimento={modelo.codigoRq === CODIGO_RQ_RECEBIMENTO}
        salvo={salvo}
        inicial={{
          titulo: modelo.titulo,
          frequencia: modelo.frequencia,
          diaSemana: modelo.diaSemana,
          diaMes: modelo.diaMes,
          ativo: modelo.ativo,
          campos: modelo.campos as unknown as CampoRq[],
        }}
      />
    </div>
  );
}
