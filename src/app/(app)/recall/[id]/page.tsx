import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { ROTULO_TIPO_RECALL, type ResultadoRecall } from "@/lib/servicos/recall";
import { ResultadoRecallView } from "@/components/resultado-recall";
import { Alerta, Cabecalho, Dl, Selo } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Recall" };

export default async function RecallDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const ctx = await exigirCtx();
  const { id } = await params;
  const { novo } = await searchParams;
  const r = await prisma.recallRegistro.findFirst({ where: { id, tenantId: ctx.tenantId }, include: { rqExecucao: { select: { id: true, codigoRq: true, numero: true, status: true } } } });
  if (!r) notFound();
  const res = r.resultado as unknown as ResultadoRecall;
  const numero = String(r.numero).padStart(4, "0");
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Cabecalho
        titulo={`${ROTULO_TIPO_RECALL[r.tipo]} nº ${numero}`}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{r.alvoCodigo}</span> · {res.alvo.descricao}
            <Selo cor={r.completo ? "verde" : "amarelo"}>{r.completo ? "Rastreio completo" : "Com pendências"}</Selo>
          </span>
        }
        acoes={
          <>
            <a href={`/api/recall/${r.id}/pdf`} target="_blank" className="btn-primario">
              Relatório em PDF
            </a>
            {res.clientes.length > 0 && (
              <a href={`/api/recall/${r.id}/clientes`} className="btn-secundario">
                Clientes (planilha)
              </a>
            )}
          </>
        }
      />
      {novo && (
        <Alerta tipo="sucesso">
          {ROTULO_TIPO_RECALL[r.tipo]} assinado em {r.duracaoMin} min.
          {r.rqExecucao ? ` ${r.rqExecucao.codigoRq} nº ${String(r.rqExecucao.numero).padStart(4, "0")} registrado automaticamente.` : r.tipo === "SIMULADO" ? " O RQ 9.1 deste semestre já estava registrado." : ""}
        </Alerta>
      )}
      <section className="cartao">
        <Dl
          itens={[
            ["Motivo", r.motivo],
            ["Início", dataHora(r.iniciadoEm)],
            ["Conclusão", dataHora(r.concluidoEm)],
            ["Tempo de rastreio", `${r.duracaoMin} min`],
            ["Assinado por", `${r.userNome} · ${ROTULO_PERFIL[r.perfil]}`],
            [
              "Registro da qualidade",
              r.rqExecucao ? (
                <Link href={`/rqs/${r.rqExecucao.id}`} className="link">
                  {r.rqExecucao.codigoRq} nº {String(r.rqExecucao.numero).padStart(4, "0")} · {r.rqExecucao.status === "CONFORME" ? "conforme" : "não conforme"}
                </Link>
              ) : (
                "—"
              ),
            ],
            ["Hash SHA-256", <span key="h" className="font-mono text-xs break-all">{r.hash}</span>],
          ]}
        />
        <p className="mt-3 text-xs text-slate-500">Fotografia do rastreio no momento da assinatura. Movimentações posteriores não alteram este registro.</p>
      </section>
      <ResultadoRecallView r={res} />
    </div>
  );
}
