import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { COR_STATUS_NC, ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_STATUS_NC } from "@/lib/servicos/nc";
import { CODIGO_RQ_RECEBIMENTO } from "@/lib/servicos/rq";
import { Cabecalho, Dl, Selo } from "@/components/ui";
import { data, dataHora } from "@/lib/formato";
import { chaveDia } from "@/lib/agenda";
import { FluxoNc } from "./fluxo";

export const metadata = { title: "Não conformidade" };

function Etapa({ titulo, feito, children }: { titulo: string; feito: boolean; children: React.ReactNode }) {
  return (
    <li className="relative pl-8">
      <span className={`absolute top-1 left-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${feito ? "bg-emerald-600" : "bg-slate-300"}`}>{feito ? "✓" : ""}</span>
      <div className="font-semibold">{titulo}</div>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </li>
  );
}

export default async function NcDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const nc = await prisma.naoConformidade.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { fornecedor: { select: { id: true, razaoSocial: true } }, rqExecucao: { select: { id: true, codigoRq: true, numero: true } } },
  });
  if (!nc) notFound();
  const vencida = nc.prazo && nc.prazo < new Date() && ["ABERTA", "EM_TRATAMENTO"].includes(nc.status);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Cabecalho
        titulo={`NC ${String(nc.numero).padStart(4, "0")}`}
        subtitulo={nc.titulo}
        acoes={
          <span className="flex gap-2">
            <Selo cor={COR_STATUS_NC[nc.status]}>{ROTULO_STATUS_NC[nc.status]}</Selo>
            <Selo cor={nc.gravidade === "ALTA" ? "vermelho" : nc.gravidade === "MEDIA" ? "amarelo" : "cinza"}>Gravidade {ROTULO_GRAVIDADE[nc.gravidade].toLowerCase()}</Selo>
          </span>
        }
      />
      <section className="cartao">
        <Dl
          itens={[
            ["Origem", ROTULO_ORIGEM_NC[nc.origem]],
            [
              "Registro de origem",
              nc.rqExecucao ? (
                <Link href={nc.rqExecucao.codigoRq === CODIGO_RQ_RECEBIMENTO ? `/recebimento/${nc.rqExecucao.id}` : `/rqs/${nc.rqExecucao.id}`} className="link">
                  {nc.rqExecucao.codigoRq} nº {String(nc.rqExecucao.numero).padStart(4, "0")}
                </Link>
              ) : "—",
            ],
            ["POP", nc.popNumero ? `POP ${String(nc.popNumero).padStart(2, "0")}` : "—"],
            ["Fornecedor", nc.fornecedor ? <Link href={`/fornecedores/${nc.fornecedor.id}`} className="link">{nc.fornecedor.razaoSocial}</Link> : "—"],
            ["Lote", nc.loteReferencia ? <Link href={`/rastreabilidade?q=${encodeURIComponent(nc.loteReferencia)}`} className="link font-mono">{nc.loteReferencia}</Link> : "—"],
            ["Prazo da ação", nc.prazo ? <span className={vencida ? "font-semibold text-red-700" : ""}>{data(nc.prazo)}{vencida && " (vencido)"}</span> : "—"],
          ]}
        />
      </section>

      <section className="cartao">
        <ol className="space-y-5">
          <Etapa titulo="1. Ocorrência e ação imediata" feito>
            <p><b>Ocorrido:</b> {nc.descricao}</p>
            <p><b>Ação imediata:</b> {nc.acaoImediata}</p>
            <p className="text-xs text-slate-500">{nc.abertaPorNome} · {dataHora(nc.abertaEm)}</p>
          </Etapa>
          <Etapa titulo="2. Causa raiz e ação preventiva" feito={!!nc.planoEm}>
            {nc.planoEm ? (
              <>
                <p><b>Causa raiz:</b> {nc.causaRaiz}</p>
                <p><b>Ação preventiva:</b> {nc.acaoPreventiva}</p>
                <p><b>Responsável:</b> {nc.responsavelAcao} · <b>prazo</b> {data(nc.prazo)}</p>
                <p className="text-xs text-slate-500">{nc.planoPorNome} · {dataHora(nc.planoEm)}</p>
              </>
            ) : (
              <span className="text-slate-500">Aguardando o RT definir o plano.</span>
            )}
          </Etapa>
          <Etapa titulo="3. Execução da ação" feito={!!nc.executadaEm}>
            {nc.executadaEm ? (
              <>
                <p>{nc.execucaoDescricao}</p>
                <p className="text-xs text-slate-500">{nc.executadaPorNome} · {dataHora(nc.executadaEm)}</p>
              </>
            ) : (
              <span className="text-slate-500">Pendente.</span>
            )}
          </Etapa>
          <Etapa titulo="4. Verificação de eficácia" feito={nc.status === "ENCERRADA"}>
            {nc.verificacaoEficacia ? <p>{nc.verificacaoEficacia}</p> : <span className="text-slate-500">Pendente.</span>}
            {nc.encerradaEm && (
              <p className="text-xs text-slate-500">
                {nc.encerradaPorNome} · {dataHora(nc.encerradaEm)}
                {nc.hashEncerramento && <span className="block font-mono break-all">SHA-256 {nc.hashEncerramento}</span>}
              </p>
            )}
          </Etapa>
        </ol>
      </section>

      <FluxoNc
        id={nc.id}
        status={nc.status}
        nomeUsuario={ctx.nome}
        plano={{ causaRaiz: nc.causaRaiz ?? "", acaoPreventiva: nc.acaoPreventiva ?? "", responsavelAcao: nc.responsavelAcao ?? "", prazo: nc.prazo ? chaveDia(nc.prazo) : "", gravidade: nc.gravidade }}
        pode={{ tratar: pode(ctx.perfil, "nc:tratar"), executar: pode(ctx.perfil, "operacao:registrar"), encerrar: pode(ctx.perfil, "nc:encerrar") }}
      />
    </div>
  );
}
