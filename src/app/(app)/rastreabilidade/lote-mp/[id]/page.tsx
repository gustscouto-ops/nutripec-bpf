import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { rastrearParaFrente } from "@/lib/servicos/rastreabilidade";
import { num } from "@/lib/db";
import { Alerta, Cabecalho, Dl, Selo, Vazio } from "@/components/ui";
import { BotaoImprimir } from "@/components/imprimir";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, data, dataHora, kg, numero } from "@/lib/formato";

export const metadata = { title: "Rastreabilidade da matéria-prima" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  const r = await rastrearParaFrente(ctx.tenantId, id);
  if (!r) notFound();
  const { lote } = r;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Cabecalho titulo="Rastreabilidade para frente (recall)" subtitulo={`${ctx.tenantNome} · da matéria-prima ao cliente`} acoes={<BotaoImprimir />} />

      <section className="cartao">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-mono text-3xl font-bold">{lote.codigoLoteInterno}</span>
          <Selo cor={COR_STATUS_LOTE[lote.status]}>{ROTULO_STATUS_LOTE[lote.status]}</Selo>
        </div>
        <Dl
          itens={[
            ["Matéria-prima", lote.materiaPrima.nomeComercial],
            ["Fornecedor", `${lote.fornecedor.razaoSocial} · CNPJ ${lote.fornecedor.cnpj}`],
            ["NF / lote do fornecedor", `${lote.numeroNf} / ${lote.loteFornecedor ?? "—"}`],
            ["Recebido em", dataHora(lote.dataRecebimento)],
            ["Validade", data(lote.dataValidade)],
            [
              "Inspeção (RQ 1.2)",
              lote.rqExecucao ? (
                <Link href={`/recebimento/${lote.rqExecucao.id}`} className="link">
                  nº {String(lote.rqExecucao.numero).padStart(4, "0")} · {lote.rqExecucao.status === "CONFORME" ? "conforme" : "não conforme"} · {lote.rqExecucao.nomeAssinatura}
                </Link>
              ) : "—",
            ],
            ["Recebido", kg(num(lote.quantidadeKg))],
            ["Consumido em produção", kg(r.consumidoKg)],
            ["Saldo no estoque de MP", kg(r.saldoKg)],
          ]}
        />
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="cartao"><div className="text-xs font-semibold text-slate-500 uppercase">Lotes de produto afetados</div><div className="text-3xl font-bold">{r.ordens.length}</div></div>
        <div className="cartao"><div className="text-xs font-semibold text-slate-500 uppercase">Clientes atingidos</div><div className="text-3xl font-bold">{r.clientes.length}</div></div>
        <div className="cartao"><div className="text-xs font-semibold text-slate-500 uppercase">Sacas ainda em estoque</div><div className="text-3xl font-bold">{numero(r.sacasEmEstoque)}</div></div>
      </div>
      {r.ordens.length > 0 && (
        <Alerta tipo="aviso">Em caso de recall: bloqueie as {numero(r.sacasEmEstoque)} sacas em estoque e contate os {r.clientes.length} cliente(s) abaixo.</Alerta>
      )}

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Bateladas em que o lote foi dosado</h2>
        {r.ordens.length ? (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Lote produzido</th><th>Produto</th><th>Produção</th><th className="text-right">Dosado</th><th className="text-right">Sacas prod.</th><th className="text-right">Expedidas</th><th className="text-right">Em estoque</th></tr></thead>
              <tbody>
                {r.ordens.map((o) => (
                  <tr key={o.ordem.id}>
                    <td className="font-mono"><Link href={`/rastreabilidade/lote-produto/${o.ordem.id}`} className="link">{o.ordem.codigoLoteProduzido}</Link></td>
                    <td>{o.ordem.produto.codigo} · {o.ordem.produto.nome}</td>
                    <td>{dataHora(o.ordem.dataHoraInicio)}</td>
                    <td className="text-right tabular-nums">{kg(o.consumoKg)}</td>
                    <td className="text-right tabular-nums">{o.ordem.quantidadeSacasProduzidas}</td>
                    <td className="text-right tabular-nums">{o.expedido}</td>
                    <td className="text-right font-semibold tabular-nums">{o.saldoSacas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vazio>Este lote ainda não foi usado em nenhuma produção.</Vazio>
        )}
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Clientes que receberam produto com este lote</h2>
        {r.clientes.length ? (
          <table className="tabela">
            <thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Cidade/UF</th><th>NFs</th><th className="text-right">Sacas</th></tr></thead>
            <tbody>
              {r.clientes.map((c) => (
                <tr key={`${c.cliente}-${c.documento}`}>
                  <td className="font-medium">{c.cliente}</td>
                  <td>{c.documento ?? "—"}</td>
                  <td>{c.cidadeUf ?? "—"}</td>
                  <td>{c.nfs.join(", ")}</td>
                  <td className="text-right tabular-nums">{c.sacas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhuma expedição com este lote.</Vazio>
        )}
      </section>
    </div>
  );
}
