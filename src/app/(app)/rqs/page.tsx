import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CODIGO_RQ_RECEBIMENTO } from "@/lib/servicos/rq";
import { Cabecalho, Selo, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Registros da qualidade" };

export default async function Rqs({ searchParams }: { searchParams: Promise<{ pop?: string; rq?: string; status?: string; p?: string }> }) {
  const ctx = await exigirCtx();
  const { pop, rq, status, p = "1" } = await searchParams;
  const pagina = Math.max(1, Number(p) || 1);
  const where: Prisma.RqExecucaoWhereInput = {
    tenantId: ctx.tenantId,
    ...(pop ? { modelo: { pop: { numeroPop: Number(pop) } } } : {}),
    ...(rq ? { codigoRq: rq } : {}),
    ...(status === "NAO_CONFORME" || status === "CONFORME" ? { status } : {}),
    ...(status === "ATRASADO" ? { atrasado: true } : {}),
    ...(status === "SEM_VERIFICACAO" ? { verificacao: { is: null } } : {}),
  };
  const [rqs, total, pops] = await Promise.all([
    prisma.rqExecucao.findMany({
      where,
      include: {
        modelo: { select: { titulo: true, pop: { select: { numeroPop: true } } } },
        verificacao: { select: { nome: true } },
        _count: { select: { naoConformidades: true, fotos: true } },
      },
      orderBy: { dataHoraExecucao: "desc" },
      skip: (pagina - 1) * 50,
      take: 50,
    }),
    prisma.rqExecucao.count({ where }),
    prisma.pop.findMany({ orderBy: { numeroPop: "asc" }, select: { numeroPop: true } }),
  ]);
  const q = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ pop, rq, status, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/rqs?${u}`;
  };
  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho titulo="Registros da qualidade (RQs)" subtitulo="Histórico assinado de todos os POPs. Cada registro gera PDF para auditoria." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={q({ pop: undefined, rq: undefined, p: undefined })} className={`rounded-full px-3 py-1.5 text-sm ${!pop && !rq ? "bg-marca-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>Todos os POPs</Link>
        {pops.map((x) => (
          <Link key={x.numeroPop} href={q({ pop: String(x.numeroPop), rq: undefined, p: undefined })} className={`rounded-full px-3 py-1.5 text-sm ${pop === String(x.numeroPop) ? "bg-marca-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            POP {String(x.numeroPop).padStart(2, "0")}
          </Link>
        ))}
        {rq && <span className="rounded-full bg-marca-600 px-3 py-1.5 text-sm text-white">{rq}</span>}
        <span className="mx-1 hidden w-px bg-slate-300 sm:block" />
        {[["", "Qualquer resultado"], ["NAO_CONFORME", "Não conformes"], ["ATRASADO", "Fora do prazo"], ["SEM_VERIFICACAO", "Aguardando verificação"]].map(([v, r]) => (
          <Link key={v} href={q({ status: v || undefined, p: undefined })} className={`rounded-full px-3 py-1.5 text-sm ${(status ?? "") === v ? "bg-slate-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>{r}</Link>
        ))}
      </div>
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {rqs.length ? (
          <table className="tabela">
            <thead><tr><th>Registro</th><th>Referência</th><th>Monitorado</th><th>Verificado</th><th>Resultado</th><th /></tr></thead>
            <tbody>
              {rqs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={r.codigoRq === CODIGO_RQ_RECEBIMENTO ? `/recebimento/${r.id}` : `/rqs/${r.id}`} className="link">
                      {r.codigoRq} nº {String(r.numero).padStart(4, "0")}
                    </Link>
                    <div className="text-xs text-slate-500">POP {String(r.modelo.pop.numeroPop).padStart(2, "0")} · {r.modelo.titulo}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    {(r.cabecalho as { periodo?: string; codigoLoteInterno?: string }).periodo ?? (r.cabecalho as { codigoLoteInterno?: string }).codigoLoteInterno ?? "—"}
                    {r.atrasado && <div><Selo cor="amarelo">fora do prazo</Selo></div>}
                  </td>
                  <td className="whitespace-nowrap">{dataHora(r.dataHoraExecucao)}<div className="text-xs text-slate-500">{r.nomeAssinatura}</div></td>
                  <td className="whitespace-nowrap">{r.verificacao ? <span className="text-sm">{r.verificacao.nome}</span> : <Selo cor="amarelo">pendente</Selo>}</td>
                  <td>
                    <Selo cor={r.status === "CONFORME" ? "verde" : "vermelho"}>{r.status === "CONFORME" ? "Conforme" : "Não conforme"}</Selo>
                    {r._count.naoConformidades > 0 && <div className="mt-1 text-xs text-slate-500">{r._count.naoConformidades} NC(s)</div>}
                  </td>
                  <td className="text-right"><a href={`/api/rq/${r.id}/pdf`} target="_blank" className="link text-sm">PDF</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum registro.</Vazio>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-600">{total} registros</span>
        <div className="flex gap-2">
          {pagina > 1 && <Link href={q({ p: String(pagina - 1) })} className="btn-secundario">Anterior</Link>}
          {pagina * 50 < total && <Link href={q({ p: String(pagina + 1) })} className="btn-secundario">Próxima</Link>}
        </div>
      </div>
    </div>
  );
}
