import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { Cabecalho, Vazio, BotaoLink } from "@/components/ui";
import { ROTULO_TURNO, dataHora, numero } from "@/lib/formato";

export const metadata = { title: "Produção" };

export default async function Producao() {
  const ctx = await exigirCtx();
  const ordens = await prisma.producaoOrdem.findMany({
    where: { tenantId: ctx.tenantId },
    include: { produto: { select: { codigo: true, nome: true } }, expedicoes: { select: { quantidadeSacas: true } }, _count: { select: { consumos: true } } },
    orderBy: { dataHoraInicio: "desc" },
    take: 200,
  });
  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Produção e sequenciamento"
        subtitulo="POP 07 — cada ordem registra a sequência do dia e os lotes de matéria-prima dosados (base da rastreabilidade)."
        acoes={pode(ctx.perfil, "operacao:registrar") && <BotaoLink href="/producao/nova">+ Nova ordem de produção</BotaoLink>}
      />
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {ordens.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote produzido</th>
                <th>Produto</th>
                <th>Data / seq.</th>
                <th>Misturador / turno</th>
                <th className="text-right">Bateladas</th>
                <th className="text-right">Sacas (estoque)</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              {ordens.map((o) => {
                const expedido = o.expedicoes.reduce((s, e) => s + e.quantidadeSacas, 0);
                return (
                  <tr key={o.id}>
                    <td className="font-mono font-semibold"><Link href={`/producao/${o.id}`} className="link">{o.codigoLoteProduzido}</Link></td>
                    <td>{o.produto.codigo} · {o.produto.nome}</td>
                    <td className="whitespace-nowrap">{dataHora(o.dataHoraInicio)}<div className="text-xs text-slate-500">{o.sequenciaDia}ª do dia</div></td>
                    <td>{o.misturador ?? "—"}<div className="text-xs text-slate-500">{ROTULO_TURNO[o.turno]}</div></td>
                    <td className="text-right tabular-nums">{o.numeroBateladas}</td>
                    <td className="text-right tabular-nums">{numero(o.quantidadeSacasProduzidas)}<div className="text-xs text-slate-500">{numero(o.quantidadeSacasProduzidas - expedido)} em estoque</div></td>
                    <td>{o.operadorNome}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhuma ordem de produção registrada.</Vazio>
        )}
      </div>
    </div>
  );
}
