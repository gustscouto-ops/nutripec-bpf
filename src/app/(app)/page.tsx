import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inicioDoDia } from "@/lib/servicos/producao";
import { Cabecalho, Indicador, Selo, Vazio, BotaoLink } from "@/components/ui";
import { dataHora, numero } from "@/lib/formato";
import type { CabecalhoRecebimento } from "@/lib/servicos/recebimento";

export const metadata = { title: "Painel" };

export default async function Painel() {
  const ctx = await exigirCtx();
  const t = ctx.tenantId;
  const hoje = inicioDoDia(new Date());
  const ha30 = new Date(Date.now() - 30 * 86400000);
  const ha90 = new Date(Date.now() - 90 * 86400000);

  const [rqsHoje, rqs30, quarentena, formulasPendentes, ordensHoje, producao30, ultimos, ncs90] = await Promise.all([
    prisma.rqExecucao.groupBy({ by: ["status"], where: { tenantId: t, dataHoraExecucao: { gte: hoje } }, _count: true }),
    prisma.rqExecucao.groupBy({ by: ["status"], where: { tenantId: t, dataHoraExecucao: { gte: ha30 } }, _count: true }),
    prisma.loteMateriaPrima.count({ where: { tenantId: t, status: "QUARENTENA" } }),
    prisma.produto.count({ where: { tenantId: t, ativo: true, statusFormula: { not: "APROVADA" } } }),
    prisma.producaoOrdem.aggregate({ where: { tenantId: t, dataHoraInicio: { gte: hoje } }, _count: true, _sum: { quantidadeSacasProduzidas: true } }),
    prisma.producaoOrdem.groupBy({ by: ["produtoId"], where: { tenantId: t, dataHoraInicio: { gte: ha30 } }, _sum: { quantidadeSacasProduzidas: true, numeroBateladas: true } }),
    prisma.rqExecucao.findMany({ where: { tenantId: t }, include: { modelo: true }, orderBy: { dataHoraExecucao: "desc" }, take: 6 }),
    prisma.loteMateriaPrima.groupBy({ by: ["fornecedorId", "status"], where: { tenantId: t, dataRecebimento: { gte: ha90 } }, _count: true }),
  ]);

  const contar = (g: { status: string; _count: number }[]) => {
    const total = g.reduce((s, x) => s + x._count, 0);
    const conformes = g.find((x) => x.status === "CONFORME")?._count ?? 0;
    return { total, conformes, pct: total ? Math.round((conformes / total) * 100) : null };
  };
  const hojeStats = contar(rqsHoje);
  const stats30 = contar(rqs30);

  const produtos = await prisma.produto.findMany({ where: { id: { in: producao30.map((p) => p.produtoId) } }, select: { id: true, nome: true, codigo: true } });
  const fornecedores = await prisma.fornecedor.findMany({ where: { id: { in: [...new Set(ncs90.map((n) => n.fornecedorId))] } }, select: { id: true, razaoSocial: true } });
  const porFornecedor = fornecedores
    .map((f) => {
      const linhas = ncs90.filter((n) => n.fornecedorId === f.id);
      const total = linhas.reduce((s, l) => s + l._count, 0);
      const nc = linhas.filter((l) => l.status !== "LIBERADO").reduce((s, l) => s + l._count, 0);
      return { ...f, total, nc };
    })
    .sort((a, b) => b.nc - a.nc || b.total - a.total);
  const maxSacas = Math.max(1, ...producao30.map((p) => p._sum.quantidadeSacasProduzidas ?? 0));

  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Gestão à vista"
        subtitulo={`${ctx.tenantNome} · ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })}`}
        acoes={
          <>
            <BotaoLink href="/recebimento/novo">+ Recebimento de carga</BotaoLink>
            <BotaoLink href="/producao/nova" variante="secundario">+ Ordem de produção</BotaoLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Conformidade hoje"
          valor={hojeStats.pct === null ? "—" : `${hojeStats.pct}%`}
          detalhe={`${hojeStats.conformes} de ${hojeStats.total} RQs conformes`}
          cor={hojeStats.pct === null ? "cinza" : hojeStats.pct >= 95 ? "verde" : hojeStats.pct >= 80 ? "amarelo" : "vermelho"}
        />
        <Indicador
          rotulo="Lotes em quarentena"
          valor={quarentena}
          detalhe="aguardando decisão do RT"
          cor={quarentena ? "vermelho" : "verde"}
          href="/recebimento?status=QUARENTENA"
        />
        <Indicador
          rotulo="Fórmulas sem aprovação"
          valor={formulasPendentes}
          detalhe="produção bloqueada até o RT assinar"
          cor={formulasPendentes ? "amarelo" : "verde"}
          href="/produtos"
        />
        <Indicador
          rotulo="Produção hoje"
          valor={numero(ordensHoje._sum.quantidadeSacasProduzidas ?? 0)}
          detalhe={`sacas em ${ordensHoje._count} ordem(ns)`}
          cor="azul"
          href="/producao"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Últimos registros da qualidade</h2>
          {ultimos.length ? (
            <ul className="divide-y divide-slate-100">
              {ultimos.map((r) => {
                const c = r.cabecalho as unknown as Partial<CabecalhoRecebimento>;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/recebimento/${r.id}`} className="link">
                        {r.modelo.codigoRq} nº {String(r.numero).padStart(4, "0")}
                      </Link>
                      <div className="truncate text-sm text-slate-600">
                        {c.materiaPrima?.nome} · {c.codigoLoteInterno} · {r.nomeAssinatura}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Selo cor={r.status === "CONFORME" ? "verde" : "vermelho"}>{r.status === "CONFORME" ? "Conforme" : "Não conforme"}</Selo>
                      <div className="mt-1 text-xs text-slate-500">{dataHora(r.dataHoraExecucao)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio>Nenhum registro ainda.</Vazio>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Últimos 30 dias: {stats30.pct ?? "—"}% de conformidade em {stats30.total} RQs.
          </p>
        </section>

        <section className="cartao">
          <h2 className="mb-3 font-semibold">Produção por produto (30 dias)</h2>
          {producao30.length ? (
            <ul className="space-y-3">
              {producao30
                .sort((a, b) => (b._sum.quantidadeSacasProduzidas ?? 0) - (a._sum.quantidadeSacasProduzidas ?? 0))
                .map((p) => {
                  const prod = produtos.find((x) => x.id === p.produtoId);
                  const sacas = p._sum.quantidadeSacasProduzidas ?? 0;
                  return (
                    <li key={p.produtoId}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{prod?.codigo} · {prod?.nome}</span>
                        <span className="tabular-nums text-slate-600">{numero(sacas)} sc · {p._sum.numeroBateladas} bat.</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-marca-500" style={{ width: `${(sacas / maxSacas) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <Vazio>Sem produção nos últimos 30 dias.</Vazio>
          )}
        </section>

        <section className="cartao lg:col-span-2">
          <h2 className="mb-1 font-semibold">Não conformidades por fornecedor (90 dias)</h2>
          <p className="mb-3 text-sm text-slate-600">Apoio à requalificação de fornecedores (POP 01).</p>
          {porFornecedor.length ? (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th className="text-right">Cargas</th>
                    <th className="text-right">Não conformes</th>
                    <th className="text-right">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {porFornecedor.map((f) => (
                    <tr key={f.id}>
                      <td><Link href={`/fornecedores/${f.id}`} className="link">{f.razaoSocial}</Link></td>
                      <td className="text-right tabular-nums">{f.total}</td>
                      <td className="text-right tabular-nums">{f.nc}</td>
                      <td className="text-right">
                        <Selo cor={f.nc === 0 ? "verde" : f.nc / f.total > 0.2 ? "vermelho" : "amarelo"}>{Math.round(((f.total - f.nc) / f.total) * 100)}% conforme</Selo>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio>Sem recebimentos nos últimos 90 dias.</Vazio>
          )}
        </section>
      </div>
    </div>
  );
}
