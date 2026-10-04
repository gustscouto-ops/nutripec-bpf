import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { pode } from "@/lib/permissions";
import { tarefas, CODIGO_RQ_RECEBIMENTO, type Tarefa } from "@/lib/servicos/rq";
import { ROTULO_FREQUENCIA } from "@/lib/rq/catalogo";
import { Cabecalho, Selo, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Tarefas do dia" };

function linkPreencher(t: Pick<Tarefa, "modelo" | "periodo">) {
  return `/rqs/novo?modelo=${t.modelo.id}&ref=${t.periodo.chave}`;
}

function CartaoTarefa({ t, podeRegistrar }: { t: Tarefa; podeRegistrar: boolean }) {
  const atrasada = t.status === "ATRASADA";
  return (
    <li className={`cartao flex flex-wrap items-center gap-3 border-l-4 ${atrasada ? "border-l-red-500 bg-red-50/40" : t.status === "CONCLUIDA" ? "border-l-emerald-500" : "border-l-amber-400"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          POP {String(t.modelo.popNumero).padStart(2, "0")} · {ROTULO_FREQUENCIA[t.modelo.frequencia]}
        </div>
        <div className="font-semibold">
          {t.modelo.codigoRq} — {t.modelo.titulo}
        </div>
        <div className="text-sm text-slate-600">
          {t.periodo.rotulo}
          {t.status !== "CONCLUIDA" && t.modelo.frequencia !== "DIARIA" && ` · vence ${dataHora(new Date(t.periodo.vencimento.getTime() - 60_000)).split(",")[0]}`}
        </div>
      </div>
      {t.status === "CONCLUIDA" && t.execucao ? (
        <Link href={`/rqs/${t.execucao.id}`} className="text-right text-sm">
          <Selo cor={t.execucao.status === "CONFORME" ? "verde" : "vermelho"}>{t.execucao.status === "CONFORME" ? "Conforme" : "Não conforme"}</Selo>
          <div className="mt-1 text-slate-500">nº {String(t.execucao.numero).padStart(4, "0")} · {t.execucao.nomeAssinatura}</div>
        </Link>
      ) : (
        podeRegistrar && (
          <Link href={linkPreencher(t)} className={atrasada ? "btn-perigo w-full sm:w-auto" : "btn-primario w-full sm:w-auto"}>
            {atrasada ? "Preencher (atrasado)" : "Preencher"}
          </Link>
        )
      )}
    </li>
  );
}

export default async function Tarefas() {
  const ctx = await exigirCtx();
  const t = await tarefas(ctx.tenantId);
  const podeRegistrar = pode(ctx.perfil, "operacao:registrar");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Cabecalho titulo="Tarefas do dia" subtitulo="RQs pendentes calculados pela frequência de cada POP. O que fica para trás aparece como atrasado." />

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-700">
          Atrasadas <Selo cor={t.atrasadas.length ? "vermelho" : "verde"}>{t.atrasadas.length}</Selo>
        </h2>
        {t.atrasadas.length ? (
          <ul className="space-y-2">{t.atrasadas.map((x) => <CartaoTarefa key={`${x.modelo.codigoRq}-${x.periodo.chave}`} t={x} podeRegistrar={podeRegistrar} />)}</ul>
        ) : (
          <Vazio>Nenhum RQ atrasado. 👏</Vazio>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          Pendentes neste período <Selo cor="amarelo">{t.pendentes.length}</Selo>
        </h2>
        {t.pendentes.length ? (
          <ul className="space-y-2">{t.pendentes.map((x) => <CartaoTarefa key={`${x.modelo.codigoRq}-${x.periodo.chave}`} t={x} podeRegistrar={podeRegistrar} />)}</ul>
        ) : (
          <Vazio>Tudo em dia neste período.</Vazio>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-semibold">Quando ocorre</h2>
        <p className="mb-2 text-sm text-slate-600">Registros acionados por um evento (chegada de carga, troca de produto, simulado, auditoria).</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {t.quandoOcorre.map((m) => (
            <Link
              key={m.id}
              href={m.codigoRq === CODIGO_RQ_RECEBIMENTO ? "/recebimento/novo" : `/rqs/novo?modelo=${m.id}`}
              className={`cartao flex items-center justify-between gap-2 py-3 hover:border-marca-500 ${podeRegistrar ? "" : "pointer-events-none opacity-60"}`}
            >
              <span>
                <span className="font-mono text-sm font-semibold">{m.codigoRq}</span> · {m.titulo}
              </span>
              <span className="text-marca-700">→</span>
            </Link>
          ))}
        </div>
      </section>

      {t.concluidas.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-emerald-700">Concluídas neste período ({t.concluidas.length})</h2>
          <ul className="space-y-2">{t.concluidas.map((x) => <CartaoTarefa key={`${x.modelo.codigoRq}-${x.periodo.chave}`} t={x} podeRegistrar={podeRegistrar} />)}</ul>
        </section>
      )}
    </div>
  );
}
