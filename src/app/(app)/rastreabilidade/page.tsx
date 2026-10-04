import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { buscarLotes } from "@/lib/servicos/rastreabilidade";
import { Cabecalho, Selo, Vazio } from "@/components/ui";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, dataHora } from "@/lib/formato";

export const metadata = { title: "Rastreabilidade" };

export default async function Rastreabilidade({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await exigirCtx();
  const { q = "" } = await searchParams;
  const r = await buscarLotes(ctx.tenantId, q);
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho titulo="Rastreabilidade bidirecional" subtitulo="POP 08 — do fornecedor ao cliente e do cliente ao fornecedor, em um clique." />
      <form className="cartao mb-6 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} autoFocus placeholder="Lote de produto (ex.: C130-031026-01), lote interno de MP, lote do fornecedor ou NF" className="campo text-lg" />
        <button className="btn-primario">Rastrear</button>
      </form>
      {q && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-1 font-semibold">Produto acabado → origem</h2>
            <p className="mb-3 text-sm text-slate-600">Rastreabilidade para trás: insumos, NFs e fornecedores.</p>
            {r.produtos.length ? (
              <ul className="space-y-2">
                {r.produtos.map((o) => (
                  <li key={o.id}>
                    <Link href={`/rastreabilidade/lote-produto/${o.id}`} className="cartao block hover:border-marca-500">
                      <div className="font-mono font-semibold">{o.codigoLoteProduzido}</div>
                      <div className="text-sm text-slate-600">{o.produto.codigo} · {o.produto.nome} · {dataHora(o.dataHoraInicio)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhum lote de produto encontrado.</Vazio>
            )}
          </section>
          <section>
            <h2 className="mb-1 font-semibold">Matéria-prima → destino (recall)</h2>
            <p className="mb-3 text-sm text-slate-600">Rastreabilidade para frente: bateladas, produtos e clientes.</p>
            {r.materiasPrimas.length ? (
              <ul className="space-y-2">
                {r.materiasPrimas.map((l) => (
                  <li key={l.id}>
                    <Link href={`/rastreabilidade/lote-mp/${l.id}`} className="cartao block hover:border-marca-500">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{l.codigoLoteInterno}</span>
                        <Selo cor={COR_STATUS_LOTE[l.status]}>{ROTULO_STATUS_LOTE[l.status]}</Selo>
                      </div>
                      <div className="text-sm text-slate-600">
                        {l.materiaPrima.nomeComercial} · {l.fornecedor.razaoSocial} · NF {l.numeroNf}
                        {l.loteFornecedor && ` · lote forn. ${l.loteFornecedor}`}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhum lote de matéria-prima encontrado.</Vazio>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
