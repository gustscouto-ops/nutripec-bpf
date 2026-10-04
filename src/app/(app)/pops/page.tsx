import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { ROTULO_FREQUENCIA } from "@/lib/rq/catalogo";
import type { CampoRq } from "@/lib/rq/campos";
import { CODIGO_RQ_RECEBIMENTO, modelosEfetivos } from "@/lib/servicos/rq";
import { itsEfetivas } from "@/lib/servicos/modelos";
import { Cabecalho, Selo } from "@/components/ui";
import { NovoItem } from "./novo-item";

export const metadata = { title: "POPs, RQs e ITs" };

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default async function Pops() {
  const ctx = await exigirCtx();
  const customiza = pode(ctx.perfil, "formulario:customizar");
  const registra = pode(ctx.perfil, "operacao:registrar");
  const [pops, modelos, its, execucoes] = await Promise.all([
    prisma.pop.findMany({ orderBy: { numeroPop: "asc" } }),
    modelosEfetivos(ctx.tenantId, { incluirInativos: true }),
    itsEfetivas(ctx.tenantId),
    prisma.rqExecucao.groupBy({ by: ["codigoRq"], where: { tenantId: ctx.tenantId }, _count: true, _max: { dataHoraExecucao: true } }),
  ]);
  const porCodigo = new Map(execucoes.map((e) => [e.codigoRq, e]));
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="POPs, Registros e Instruções"
        subtitulo="Os 9 POPs obrigatórios da IN MAPA 04/2007 já vêm estruturados. O RT pode adaptar os formulários (RQs) e as instruções de trabalho (ITs) à realidade da fábrica; registros já assinados não mudam."
      />
      <div className="space-y-3">
        {pops.map((p) => {
          const rqs = modelos.filter((m) => m.popId === p.id);
          const itsPop = its.filter((i) => i.popId === p.id);
          return (
            <details key={p.id} className="cartao group" open={p.numeroPop === 1}>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca-100 font-bold text-marca-900">{String(p.numeroPop).padStart(2, "0")}</span>
                <div className="flex-1">
                  <div className="font-semibold">
                    POP {String(p.numeroPop).padStart(2, "0")} — {p.titulo}
                  </div>
                  <div className="text-sm text-slate-600">{p.descricaoProcedimento}</div>
                </div>
                <span className="text-slate-400 transition group-open:rotate-90">›</span>
              </summary>

              <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Registros da qualidade</h3>
              <ul className="space-y-2">
                {rqs.map((m) => {
                  const ex = porCodigo.get(m.codigoRq);
                  const destino = m.codigoRq === CODIGO_RQ_RECEBIMENTO ? "/recebimento/novo" : `/rqs/novo?modelo=${m.id}`;
                  const quando =
                    m.frequencia === "SEMANAL" || m.frequencia === "QUINZENAL"
                      ? ` · até ${DIAS[m.diaSemana ?? 5]}`
                      : ["MENSAL", "SEMESTRAL", "ANUAL"].includes(m.frequencia) && m.diaMes
                        ? ` · até dia ${m.diaMes}`
                        : "";
                  return (
                    <li key={m.id} className={`rounded-lg border border-slate-200 p-3 ${m.ativo ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-sm font-semibold">{m.codigoRq}</span> · {m.titulo}
                          <div className="text-xs text-slate-500">
                            {(m.campos as unknown as CampoRq[]).length} itens · v{m.versao}
                            {m.tenantId ? " · versão da empresa" : " · padrão"} · {ex ? `${ex._count} registro(s)` : "sem registros"}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Selo cor="azul">
                            {ROTULO_FREQUENCIA[m.frequencia]}
                            {quando}
                          </Selo>
                          {!m.ativo && <Selo>Desativado</Selo>}
                          {customiza && (
                            <Link href={`/pops/modelos/${m.id}`} className="btn-secundario min-h-9 py-1">
                              Personalizar
                            </Link>
                          )}
                          {registra && m.ativo && (
                            <Link href={destino} className="btn-primario min-h-9 py-1">
                              Preencher
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Instruções de trabalho</h3>
              {itsPop.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {itsPop.map((i) => (
                    <li key={i.id} className={i.ativo ? "" : "opacity-60"}>
                      <Link href={`/instrucoes/${i.id}`} className="block rounded-lg border border-slate-200 p-3 hover:border-marca-500">
                        <span className="font-mono text-sm font-semibold">{i.codigo}</span> · {i.titulo}
                        <div className="text-xs text-slate-500">
                          {(i.passos as unknown[]).length} passos · v{i.versao}
                          {i.ativo ? "" : " · desativada"}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma instrução cadastrada.</p>
              )}
              {customiza && <NovoItem popId={p.id} numeroPop={p.numeroPop} />}
            </details>
          );
        })}
      </div>
    </div>
  );
}
