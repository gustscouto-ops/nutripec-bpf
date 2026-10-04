import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode, ROTULO_PERFIL } from "@/lib/permissions";
import type { CampoRq, Respostas } from "@/lib/rq/campos";
import type { CabecalhoRecebimento } from "@/lib/servicos/recebimento";
import { Alerta, Cabecalho, Dl, Selo } from "@/components/ui";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, data, dataHora, kg } from "@/lib/formato";
import { COR_STATUS_NC, ROTULO_STATUS_NC } from "@/lib/servicos/nc";
import { DecisaoRt } from "./decisao";

export const metadata = { title: "Recebimento" };

const ROT_RESP: Record<string, string> = { C: "Conforme", NC: "Não conforme", NA: "N/A" };

export default async function RecebimentoDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { id } = await params;
  const { novo } = await searchParams;
  const ctx = await exigirCtx();
  const rq = await prisma.rqExecucao.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { modelo: { include: { pop: true } }, fotos: true, loteMp: true, naoConformidades: { orderBy: { numero: "asc" } } },
  });
  if (!rq) notFound();
  const c = rq.cabecalho as unknown as CabecalhoRecebimento;
  const respostas = rq.respostas as unknown as Respostas;
  const campos = rq.modelo.campos as unknown as CampoRq[];
  const lote = rq.loteMp;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Cabecalho
        titulo={`${rq.modelo.codigoRq} nº ${String(rq.numero).padStart(4, "0")}`}
        subtitulo={`POP 0${rq.modelo.pop.numeroPop} · ${rq.modelo.titulo}`}
        acoes={
          <>
            <a href={`/api/rq/${rq.id}/pdf`} target="_blank" className="btn-primario">Baixar PDF assinado</a>
            {lote && <Link href={`/rastreabilidade/lote-mp/${lote.id}`} className="btn-secundario">Rastrear lote</Link>}
          </>
        }
      />
      {novo && (
        <Alerta tipo={rq.status === "CONFORME" ? "sucesso" : "aviso"}>
          Registro assinado. Lote interno <b className="font-mono">{c.codigoLoteInterno}</b>{" "}
          {rq.status === "CONFORME" ? "liberado para produção." : "em quarentena aguardando decisão do RT."}
        </Alerta>
      )}

      <section className="cartao">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="font-mono text-3xl font-bold">{c.codigoLoteInterno}</div>
          <Selo cor={rq.status === "CONFORME" ? "verde" : "vermelho"}>{rq.status === "CONFORME" ? "Inspeção conforme" : "Inspeção não conforme"}</Selo>
          {lote && <Selo cor={COR_STATUS_LOTE[lote.status]}>Lote {ROTULO_STATUS_LOTE[lote.status].toLowerCase()}</Selo>}
        </div>
        <Dl
          itens={[
            ["Fornecedor", <>{c.fornecedor.razaoSocial}<div className="text-xs text-slate-500">CNPJ {c.fornecedor.cnpj} · MAPA {c.fornecedor.registroMapa ?? "—"}</div></>],
            ["Matéria-prima", c.materiaPrima.nome],
            ["Nota fiscal", c.numeroNf],
            ["Peso da carga", kg(c.quantidadeKg)],
            ["Lote do fornecedor", c.loteFornecedor],
            ["Fabricação / validade", `${data(c.dataFabricacao)} / ${data(c.dataValidade)}`],
            ["Veículo", [c.placaVeiculo, c.transportadora, c.motorista].filter(Boolean).join(" · ") || "—"],
            ["Data/hora do registro", dataHora(rq.dataHoraExecucao)],
          ]}
        />
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Checklist de inspeção</h2>
        <ul className="divide-y divide-slate-100">
          {campos.map((campo) => {
            const r = respostas[campo.id];
            const nc = r && r.conforme === false;
            return (
              <li key={campo.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span>{campo.rotulo}</span>
                  <span className="shrink-0">
                    {campo.tipo === "numerico" ? (
                      <Selo cor={nc ? "vermelho" : "verde"}>{String(r?.valor ?? "—")} {campo.unidade}</Selo>
                    ) : (
                      <Selo cor={nc ? "vermelho" : r?.valor === "NA" ? "cinza" : "verde"}>{ROT_RESP[String(r?.valor)] ?? "—"}</Selo>
                    )}
                  </span>
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
          <h2 className="mb-3 font-semibold">Não conformidades abertas por este recebimento</h2>
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
        <h2 className="mb-3 font-semibold">Assinatura eletrônica</h2>
        <Dl
          itens={[
            ["Assinado por", rq.nomeAssinatura],
            ["Perfil", ROTULO_PERFIL[rq.perfilAssinatura]],
            ["Data/hora", dataHora(rq.dataHoraExecucao)],
            ["Hash SHA-256 do conteúdo", <span key="h" className="font-mono text-xs break-all">{rq.hashAssinatura}</span>],
          ]}
        />
      </section>

      {lote && lote.status !== "QUARENTENA" && lote.decisaoRtEm && (
        <section className="cartao">
          <h2 className="mb-2 font-semibold">Decisão do Responsável Técnico</h2>
          <p className="text-sm">
            <Selo cor={COR_STATUS_LOTE[lote.status]}>{ROTULO_STATUS_LOTE[lote.status]}</Selo> por {lote.decisaoRtNome} em {dataHora(lote.decisaoRtEm)}
          </p>
          <p className="mt-2 text-sm">{lote.decisaoRtMotivo}</p>
        </section>
      )}

      {lote?.status === "QUARENTENA" &&
        (pode(ctx.perfil, "lote:decidir") ? (
          <DecisaoRt loteId={lote.id} nomeUsuario={ctx.nome} />
        ) : (
          <Alerta tipo="aviso">Lote em quarentena: aguarda decisão do Responsável Técnico. Não pode ser usado na produção.</Alerta>
        ))}
    </div>
  );
}
