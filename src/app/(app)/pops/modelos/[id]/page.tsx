import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { CODIGO_RQ_RECEBIMENTO, modeloEfetivo } from "@/lib/servicos/rq";
import { historicoRevisoes } from "@/lib/servicos/modelos";
import { data, dataHora } from "@/lib/formato";
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
  const [registros, revisoes] = await Promise.all([
    prisma.rqExecucao.count({ where: { tenantId: ctx.tenantId, codigoRq: modelo.codigoRq } }),
    historicoRevisoes(ctx.tenantId, modelo.codigoRq),
  ]);
  const rev = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="mx-auto max-w-4xl">
      <Cabecalho
        titulo={`${modelo.codigoRq} — personalizar formulário`}
        subtitulo={
          <>
            POP {String(modelo.pop.numeroPop).padStart(2, "0")} · {modelo.pop.titulo} · revisão {rev(modelo.versao)} de {data(modelo.dataRevisao)}
            {modelo.tenantId ? ` (versão da empresa, por ${modelo.atualizadoPor ?? "—"})` : " (padrão do sistema)"}
          </>
        }
        acoes={
          <>
            <a href={`/api/rq/modelo/${modelo.id}/pdf`} target="_blank" className="btn-secundario">
              PDF em branco
            </a>
            <Link href="/pops" className="btn-secundario">
              Voltar
            </Link>
          </>
        }
      />
      <div className="mb-4">
        <Alerta tipo="info">
          {registros} registro(s) já assinado(s) guardam a revisão do formulário em que foram feitos e não mudam. Alterar o formulário gera a revisão {rev(modelo.versao + 1)}, usada nos
          próximos preenchimentos e no formulário em branco. A IN 04/2007 (item 7.14) pede revisão dos POPs pelo menos uma vez ao ano e sempre que o procedimento mudar.
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
          orientacoes: modelo.orientacoes ?? "",
          registrosPorFolha: modelo.registrosPorFolha,
          versao: modelo.versao,
        }}
      />

      <section className="cartao mb-10 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Histórico de revisões</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Rev.</th>
              <th>Data</th>
              <th>Motivo e alterações</th>
              <th>Por</th>
            </tr>
          </thead>
          <tbody>
            {revisoes.map((r) => (
              <tr key={r.id}>
                <td className="font-mono font-semibold">{rev(r.revisao)}</td>
                <td className="whitespace-nowrap">{data(r.dataRevisao)}</td>
                <td>
                  <div>{r.motivo}</div>
                  <div className="text-xs text-slate-500">{r.alteracoes}</div>
                  {!r.tenantId && <div className="text-xs text-slate-400">modelo padrão do sistema</div>}
                </td>
                <td className="whitespace-nowrap text-sm">
                  {r.userNome}
                  <div className="text-xs text-slate-500">{dataHora(r.createdAt)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
