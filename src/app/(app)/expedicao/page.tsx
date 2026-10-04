import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";
import { FormExpedicao } from "./form";

export const metadata = { title: "Expedição" };

export default async function Expedicao({ searchParams }: { searchParams: Promise<{ lote?: string }> }) {
  const ctx = await exigirCtx();
  const { lote } = await searchParams;
  const [envios, ordens] = await Promise.all([
    prisma.expedicaoEnvio.findMany({
      where: { tenantId: ctx.tenantId },
      include: { ordem: { select: { id: true, codigoLoteProduzido: true, produto: { select: { codigo: true, nome: true } } } } },
      orderBy: { dataHora: "desc" },
      take: 200,
    }),
    prisma.producaoOrdem.findMany({
      where: { tenantId: ctx.tenantId },
      include: { produto: { select: { codigo: true, nome: true } }, expedicoes: { select: { quantidadeSacas: true } } },
      orderBy: { dataHoraInicio: "desc" },
      take: 300,
    }),
  ]);
  const disponiveis = ordens
    .map((o) => ({
      id: o.id,
      rotulo: `${o.codigoLoteProduzido} · ${o.produto.codigo} ${o.produto.nome}`,
      saldo: o.quantidadeSacasProduzidas - o.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0),
    }))
    .filter((o) => o.saldo > 0);

  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho titulo="Expedição / venda" subtitulo="Saída do produto acabado: fecha a rastreabilidade até o cliente." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {pode(ctx.perfil, "operacao:registrar") && <FormExpedicao lotes={disponiveis} loteInicial={lote} />}
        <div className="cartao overflow-x-auto p-0 sm:p-0 lg:col-start-2">
          {envios.length ? (
            <table className="tabela">
              <thead><tr><th>Data</th><th>Cliente</th><th>NF / placa</th><th>Lote</th><th className="text-right">Sacas</th></tr></thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{dataHora(e.dataHora)}<div className="text-xs text-slate-500">{e.userNome}</div></td>
                    <td>{e.clienteNome}<div className="text-xs text-slate-500">{[e.clienteDocumento, e.clienteCidadeUf].filter(Boolean).join(" · ")}</div></td>
                    <td>NF {e.numeroNf}<div className="text-xs text-slate-500">{e.placaVeiculo}</div></td>
                    <td className="font-mono"><Link href={`/rastreabilidade/lote-produto/${e.ordem.id}`} className="link">{e.ordem.codigoLoteProduzido}</Link><div className="font-sans text-xs text-slate-500">{e.ordem.produto.nome}</div></td>
                    <td className="text-right tabular-nums">{e.quantidadeSacas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Vazio>Nenhuma expedição registrada.</Vazio>
          )}
        </div>
      </div>
    </div>
  );
}
