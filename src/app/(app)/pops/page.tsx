import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROTULO_FREQUENCIA } from "@/lib/rq/catalogo";
import type { CampoRq } from "@/lib/rq/campos";
import { Cabecalho, Selo } from "@/components/ui";

export const metadata = { title: "POPs e RQs" };

export default async function Pops() {
  const ctx = await exigirCtx();
  const [pops, execucoes] = await Promise.all([
    prisma.pop.findMany({ include: { modelos: { orderBy: { codigoRq: "asc" } } }, orderBy: { numeroPop: "asc" } }),
    prisma.rqExecucao.groupBy({ by: ["rqModeloId"], where: { tenantId: ctx.tenantId }, _count: true, _max: { dataHoraExecucao: true } }),
  ]);
  const porModelo = new Map(execucoes.map((e) => [e.rqModeloId, e]));
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="POPs e Registros da Qualidade"
        subtitulo="Os 9 POPs obrigatórios da IN MAPA 04/2007, pré-estruturados. Nesta fase o RQ 1.2 está em operação; os demais entram na Fase 2 com agendamento e alertas."
      />
      <div className="space-y-3">
        {pops.map((p) => (
          <details key={p.id} className="cartao group" open={p.numeroPop === 1}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca-100 font-bold text-marca-900">{String(p.numeroPop).padStart(2, "0")}</span>
              <div className="flex-1">
                <div className="font-semibold">POP {String(p.numeroPop).padStart(2, "0")} — {p.titulo}</div>
                <div className="text-sm text-slate-600">{p.descricaoProcedimento}</div>
              </div>
              <span className="text-slate-400 transition group-open:rotate-90">›</span>
            </summary>
            <ul className="mt-4 space-y-2">
              {p.modelos.map((m) => {
                const ex = porModelo.get(m.id);
                const ativo = m.codigoRq === "RQ 1.2";
                return (
                  <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold">{m.codigoRq}</span> · {m.titulo}
                        <div className="text-xs text-slate-500">
                          {(m.campos as unknown as CampoRq[]).length} itens de verificação · {ex ? `${ex._count} registro(s)` : "sem registros"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Selo cor="azul">{ROTULO_FREQUENCIA[m.frequencia]}</Selo>
                        {ativo ? <Link href="/recebimento/novo" className="btn-primario min-h-9 py-1">Preencher</Link> : <Selo>Fase 2</Selo>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
