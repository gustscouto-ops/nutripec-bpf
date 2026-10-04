import Link from "next/link";
import type { StatusLote } from "@prisma/client";
import { exigirCtx } from "@/lib/auth";
import { prisma, num } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { saldosLotes } from "@/lib/servicos/recebimento";
import { Cabecalho, Vazio, BotaoLink, Selo } from "@/components/ui";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, dataHora, kg } from "@/lib/formato";

export const metadata = { title: "Recebimento" };

export default async function Recebimentos({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const ctx = await exigirCtx();
  const { status, q } = await searchParams;
  const filtroStatus = (["LIBERADO", "QUARENTENA", "REPROVADO"] as StatusLote[]).find((s) => s === status);
  const lotes = await prisma.loteMateriaPrima.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(filtroStatus ? { status: filtroStatus } : {}),
      ...(q ? { OR: [{ codigoLoteInterno: { contains: q, mode: "insensitive" } }, { numeroNf: { contains: q } }, { loteFornecedor: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { materiaPrima: true, fornecedor: true, rqExecucao: { select: { id: true, numero: true, status: true, nomeAssinatura: true } } },
    orderBy: { dataRecebimento: "desc" },
    take: 200,
  });
  const consumos = await saldosLotes(ctx.tenantId, lotes.map((l) => l.id));
  const filtros: [string, string | undefined][] = [["Todos", undefined], ["Liberados", "LIBERADO"], ["Quarentena", "QUARENTENA"], ["Reprovados", "REPROVADO"]];

  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Recebimento de matérias-primas"
        subtitulo="POP 01 · RQ 1.2 — Recebimento e Inspeção de Carga. Cada carga gera um lote interno rastreável."
        acoes={pode(ctx.perfil, "operacao:registrar") && <BotaoLink href="/recebimento/novo">+ Registrar carga</BotaoLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filtros.map(([rot, s]) => (
          <Link
            key={rot}
            href={s ? `/recebimento?status=${s}` : "/recebimento"}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${filtroStatus === s ? "bg-marca-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {rot}
          </Link>
        ))}
        <form className="ml-auto">
          {filtroStatus && <input type="hidden" name="status" value={filtroStatus} />}
          <input name="q" defaultValue={q} placeholder="Buscar lote, NF…" className="campo py-1.5" />
        </form>
      </div>
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {lotes.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote interno</th>
                <th>Matéria-prima</th>
                <th>Fornecedor / NF</th>
                <th>Recebido</th>
                <th className="text-right">Qtde / saldo</th>
                <th>Inspeção</th>
                <th>Lote</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono font-semibold">
                    {l.rqExecucao ? <Link href={`/recebimento/${l.rqExecucao.id}`} className="link">{l.codigoLoteInterno}</Link> : l.codigoLoteInterno}
                  </td>
                  <td>{l.materiaPrima.nomeComercial}</td>
                  <td>
                    {l.fornecedor.razaoSocial}
                    <div className="text-xs text-slate-500">NF {l.numeroNf}{l.loteFornecedor && ` · lote forn. ${l.loteFornecedor}`}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    {dataHora(l.dataRecebimento)}
                    <div className="text-xs text-slate-500">{l.rqExecucao?.nomeAssinatura}</div>
                  </td>
                  <td className="text-right tabular-nums whitespace-nowrap">
                    {kg(num(l.quantidadeKg))}
                    <div className="text-xs text-slate-500">saldo {kg(num(l.quantidadeKg) - (consumos.get(l.id) ?? 0))}</div>
                  </td>
                  <td>{l.rqExecucao && <Selo cor={l.rqExecucao.status === "CONFORME" ? "verde" : "vermelho"}>{l.rqExecucao.status === "CONFORME" ? "Conforme" : "Não conforme"}</Selo>}</td>
                  <td><Selo cor={COR_STATUS_LOTE[l.status]}>{ROTULO_STATUS_LOTE[l.status]}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhum recebimento encontrado.</Vazio>
        )}
      </div>
    </div>
  );
}
