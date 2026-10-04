import Link from "next/link";
import type { StatusNc } from "@prisma/client";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { COR_STATUS_NC, ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_STATUS_NC } from "@/lib/servicos/nc";
import { BotaoLink, Cabecalho, Selo, Vazio } from "@/components/ui";
import { data } from "@/lib/formato";

export const metadata = { title: "Não conformidades" };
const ABERTAS: StatusNc[] = ["ABERTA", "EM_TRATAMENTO", "AGUARDANDO_VERIFICACAO"];

export default async function Ncs({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const ctx = await exigirCtx();
  const { filtro = "abertas" } = await searchParams;
  const agora = new Date();
  const where =
    filtro === "todas" ? {} : filtro === "vencidas" ? { status: { in: ["ABERTA", "EM_TRATAMENTO"] as StatusNc[] }, prazo: { lt: agora } } : filtro in ROTULO_STATUS_NC ? { status: filtro as StatusNc } : { status: { in: ABERTAS } };
  const [ncs, contagem] = await Promise.all([
    prisma.naoConformidade.findMany({ where: { tenantId: ctx.tenantId, ...where }, include: { fornecedor: { select: { razaoSocial: true } } }, orderBy: { numero: "desc" }, take: 300 }),
    prisma.naoConformidade.groupBy({ by: ["status"], where: { tenantId: ctx.tenantId }, _count: true }),
  ]);
  const n = (s: StatusNc) => contagem.find((c) => c.status === s)?._count ?? 0;
  const filtros: [string, string][] = [
    ["abertas", `Em aberto (${ABERTAS.reduce((s, x) => s + n(x), 0)})`],
    ["ABERTA", `Sem plano (${n("ABERTA")})`],
    ["EM_TRATAMENTO", `Em tratamento (${n("EM_TRATAMENTO")})`],
    ["AGUARDANDO_VERIFICACAO", `Aguardando eficácia (${n("AGUARDANDO_VERIFICACAO")})`],
    ["vencidas", "Prazo vencido"],
    ["ENCERRADA", `Encerradas (${n("ENCERRADA")})`],
    ["todas", "Todas"],
  ];
  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Não conformidades"
        subtitulo="Ação imediata → causa raiz e ação preventiva → execução → verificação de eficácia pelo RT."
        acoes={pode(ctx.perfil, "operacao:registrar") && <BotaoLink href="/nao-conformidades/nova">+ Registrar NC</BotaoLink>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map(([v, r]) => (
          <Link key={v} href={`/nao-conformidades?filtro=${v}`} className={`rounded-full px-3 py-1.5 text-sm ${filtro === v ? "bg-marca-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{r}</Link>
        ))}
      </div>
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {ncs.length ? (
          <table className="tabela">
            <thead><tr><th>NC</th><th>Origem</th><th>Aberta</th><th>Prazo</th><th>Gravidade</th><th>Situação</th></tr></thead>
            <tbody>
              {ncs.map((x) => {
                const vencida = x.prazo && x.prazo < agora && ["ABERTA", "EM_TRATAMENTO"].includes(x.status);
                return (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/nao-conformidades/${x.id}`} className="link">NC {String(x.numero).padStart(4, "0")}</Link>
                      <div className="max-w-md text-sm">{x.titulo}</div>
                      {x.fornecedor && <div className="text-xs text-slate-500">{x.fornecedor.razaoSocial}</div>}
                    </td>
                    <td className="text-sm">{ROTULO_ORIGEM_NC[x.origem]}{x.popNumero && <div className="text-xs text-slate-500">POP {String(x.popNumero).padStart(2, "0")}</div>}</td>
                    <td className="whitespace-nowrap">{data(x.abertaEm)}<div className="text-xs text-slate-500">{x.abertaPorNome}</div></td>
                    <td className={vencida ? "font-semibold text-red-700" : ""}>{x.prazo ? data(x.prazo) : "—"}</td>
                    <td><Selo cor={x.gravidade === "ALTA" ? "vermelho" : x.gravidade === "MEDIA" ? "amarelo" : "cinza"}>{ROTULO_GRAVIDADE[x.gravidade]}</Selo></td>
                    <td><Selo cor={COR_STATUS_NC[x.status]}>{ROTULO_STATUS_NC[x.status]}</Selo></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhuma não conformidade neste filtro.</Vazio>
        )}
      </div>
    </div>
  );
}
