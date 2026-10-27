import type { RqVerificacao } from "@prisma/client";
import type { Ctx } from "@/lib/auth";
import { pode, ROTULO_PERFIL } from "@/lib/permissions";
import { dataHora } from "@/lib/formato";
import { Dl, Selo } from "./ui";
import { VerificarRq } from "./verificacao-rq";

/** Quadro de verificação do RQ: mostra quem verificou ou, para o RT/consultor, o formulário de assinatura. */
export function BlocoVerificacao({ ctx, rq }: { ctx: Ctx; rq: { id: string; status: string; userIdAssinatura: string; verificacao: RqVerificacao | null } }) {
  const v = rq.verificacao;
  return (
    <section className="cartao">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Verificação</h2>
        <Selo cor={v ? "verde" : "amarelo"}>{v ? "Verificado" : "Aguardando verificação"}</Selo>
      </div>
      {v ? (
        <Dl
          itens={[
            ["Verificado por", `${v.nome} (${ROTULO_PERFIL[v.perfil]}${v.registroProfissional ? ` · ${v.registroProfissional}` : ""})`],
            ["Data/hora", dataHora(v.dataHora)],
            ["Parecer", v.parecer ?? "—"],
            ["Hash SHA-256 da verificação", <span key="h" className="font-mono text-xs break-all">{v.hash}</span>],
          ]}
        />
      ) : !pode(ctx.perfil, "rq:verificar") ? (
        <p className="text-sm text-slate-600">O RT ou o consultor confere este registro e assina a verificação.</p>
      ) : rq.userIdAssinatura === ctx.userId ? (
        <p className="text-sm text-slate-600">Você monitorou e assinou este registro. A verificação precisa ser feita por outra pessoa (RT ou consultor).</p>
      ) : (
        <VerificarRq rqId={rq.id} naoConforme={rq.status === "NAO_CONFORME"} />
      )}
    </section>
  );
}
