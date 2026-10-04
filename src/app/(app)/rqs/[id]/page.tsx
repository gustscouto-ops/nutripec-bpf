import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { CODIGO_RQ_RECEBIMENTO } from "@/lib/servicos/rq";
import { COR_STATUS_NC, ROTULO_STATUS_NC } from "@/lib/servicos/nc";
import type { CampoRq, Respostas } from "@/lib/rq/campos";
import { Alerta, Cabecalho, Dl, Selo } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Registro da qualidade" };
const ROT: Record<string, string> = { C: "Conforme", NC: "Não conforme", NA: "N/A" };

export default async function RqDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { id } = await params;
  const { novo } = await searchParams;
  const ctx = await exigirCtx();
  const rq = await prisma.rqExecucao.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { modelo: { include: { pop: true } }, fotos: true, naoConformidades: { orderBy: { numero: "asc" } } },
  });
  if (!rq) notFound();
  if (rq.codigoRq === CODIGO_RQ_RECEBIMENTO) redirect(`/recebimento/${rq.id}${novo ? "?novo=1" : ""}`);
  const campos = ((rq.campos as unknown as CampoRq[]).length ? rq.campos : rq.modelo.campos) as unknown as CampoRq[];
  const respostas = rq.respostas as unknown as Respostas;
  const periodo = (rq.cabecalho as { periodo?: string }).periodo;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Cabecalho
        titulo={`${rq.codigoRq} nº ${String(rq.numero).padStart(4, "0")}`}
        subtitulo={`POP ${String(rq.modelo.pop.numeroPop).padStart(2, "0")} · ${rq.modelo.titulo}`}
        acoes={<a href={`/api/rq/${rq.id}/pdf`} target="_blank" className="btn-primario">Baixar PDF assinado</a>}
      />
      {novo && (
        <Alerta tipo={rq.status === "CONFORME" ? "sucesso" : "aviso"}>
          Registro assinado.{rq.naoConformidades.length > 0 && ` ${rq.naoConformidades.length} não conformidade(s) aberta(s) para tratamento do RT.`}
        </Alerta>
      )}
      <section className="cartao">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Selo cor={rq.status === "CONFORME" ? "verde" : "vermelho"}>{rq.status === "CONFORME" ? "Conforme" : "Não conforme"}</Selo>
          {rq.atrasado && <Selo cor="amarelo">Preenchido fora do prazo</Selo>}
          <Selo>formulário v{rq.versaoModelo}</Selo>
        </div>
        <Dl itens={[["Referência", periodo ?? "—"], ["Assinado por", `${rq.nomeAssinatura} (${ROTULO_PERFIL[rq.perfilAssinatura]})`], ["Data/hora", dataHora(rq.dataHoraExecucao)]]} />
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Itens verificados</h2>
        <ul className="divide-y divide-slate-100">
          {campos.map((c) => {
            const r = respostas[c.id];
            const nc = r?.conforme === false;
            return (
              <li key={c.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span>{c.rotulo}</span>
                  <Selo cor={nc ? "vermelho" : r?.valor === "NA" ? "cinza" : "verde"}>
                    {c.tipo === "conformidade" ? (ROT[String(r?.valor)] ?? "—") : `${r?.valor ?? "—"} ${c.unidade ?? ""}`}
                  </Selo>
                </div>
                {nc && (
                  <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm">
                    <div><b>Ocorrido:</b> {r.descricaoNc}</div>
                    <div><b>Ação corretiva imediata:</b> {r.acaoCorretiva}</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {rq.observacoes && <p className="mt-3 text-sm"><b>Observações:</b> {rq.observacoes}</p>}
      </section>

      {rq.naoConformidades.length > 0 && (
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Não conformidades abertas por este registro</h2>
          <ul className="space-y-2">
            {rq.naoConformidades.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2">
                <Link href={`/nao-conformidades/${n.id}`} className="link">NC {String(n.numero).padStart(4, "0")} — {n.titulo}</Link>
                <Selo cor={COR_STATUS_NC[n.status]}>{ROTULO_STATUS_NC[n.status]}</Selo>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rq.fotos.length > 0 && (
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Evidências fotográficas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rq.fotos.map((f) => (
              <a key={f.id} href={`/api/fotos/${f.id}`} target="_blank" className="overflow-hidden rounded-lg border border-slate-200">
                <img src={`/api/fotos/${f.id}`} alt={f.descricao ?? "Foto"} className="aspect-[4/3] w-full object-cover" />
                {f.descricao && <div className="p-2 text-sm">{f.descricao}</div>}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="cartao">
        <h2 className="mb-2 font-semibold">Assinatura eletrônica</h2>
        <p className="font-mono text-xs break-all text-slate-600">SHA-256: {rq.hashAssinatura}</p>
      </section>
    </div>
  );
}
