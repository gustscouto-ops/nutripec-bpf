import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { pode } from "@/lib/permissions";
import { dadosRotulo } from "@/lib/servicos/rotulagem";
import { gerarZpl, pendenciasRotulo, TAMANHOS, type Tamanho } from "@/lib/rotulo";
import { PreviaRotulo } from "@/components/previa-rotulo";
import { Alerta, Cabecalho } from "@/components/ui";

export const metadata = { title: "Rótulo" };

export default async function Rotulo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tamanho?: string; ordem?: string }> }) {
  const ctx = await exigirCtx();
  const { id } = await params;
  const sp = await searchParams;
  const tamanho: Tamanho = sp.tamanho && sp.tamanho in TAMANHOS ? (sp.tamanho as Tamanho) : "100x150";
  let r;
  try {
    r = await dadosRotulo(ctx.tenantId, sp.ordem ? { ordemId: sp.ordem } : { produtoId: id });
  } catch {
    notFound();
  }
  if (r.produto.id !== id) notFound();
  const pendencias = pendenciasRotulo(r.dados);
  const { cabe, fonteCorpo } = gerarZpl(r.dados, { tamanho });
  const t = TAMANHOS[tamanho];
  return (
    <div className="mx-auto max-w-5xl pb-10">
      <style>{`@media print { @page { size: ${t.larguraMm}mm ${t.alturaMm}mm; margin: 0 } body * { visibility: hidden } .etiqueta, .etiqueta * { visibility: visible } .etiqueta { position: absolute; left: 0; top: 0; border: 0; box-shadow: none } }`}</style>
      <Cabecalho
        titulo={`Rótulo · ${r.produto.codigo} ${r.produto.nome}`}
        subtitulo={r.ordem ? `Etiqueta do lote ${r.ordem.codigoLoteProduzido} (${r.ordem.quantidadeSacasProduzidas} sacas)` : `Modelo do rótulo, fórmula versão ${r.produto.versaoFormula}`}
        acoes={
          <Link href={r.ordem ? `/producao/${r.ordem.id}` : `/produtos/${id}`} className="btn-secundario">
            Voltar
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-x-auto rounded-xl bg-slate-200 p-6">
          <PreviaRotulo dados={r.dados} tamanho={tamanho} />
        </div>
        <aside className="space-y-4">
          {r.avisos.map((a) => (
            <Alerta key={a} tipo="aviso">
              {a}
            </Alerta>
          ))}
          {pendencias.length ? (
            <Alerta>
              <b>Itens obrigatórios faltando:</b>
              <ul className="mt-1 list-disc pl-5">
                {pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alerta>
          ) : (
            <Alerta tipo="sucesso">Todos os itens obrigatórios do rótulo estão preenchidos.</Alerta>
          )}
          {!cabe && <Alerta tipo="aviso">O texto não cabe nesta etiqueta nem com a menor fonte. Use uma etiqueta maior ou encurte os textos.</Alerta>}

          <section className="cartao space-y-3">
            <div className="rotulo">Tamanho da etiqueta</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TAMANHOS) as Tamanho[]).map((k) => (
                <Link key={k} href={`?${new URLSearchParams({ tamanho: k, ...(sp.ordem ? { ordem: sp.ordem } : {}) })}`} className={k === tamanho ? "btn-primario min-h-9 py-1" : "btn-secundario min-h-9 py-1"}>
                  {k.replace("x", " × ")}
                </Link>
              ))}
            </div>
            <p className="text-xs text-slate-500">Fonte do corpo no ZPL: {fonteCorpo} dots (203 dpi).</p>
            {r.aprovada && pode(ctx.perfil, "operacao:registrar") ? (
              <form action="/api/rotulo" method="get" className="space-y-2">
                <input type="hidden" name="produto" value={id} />
                <input type="hidden" name="tamanho" value={tamanho} />
                {sp.ordem && <input type="hidden" name="ordem" value={sp.ordem} />}
                <label className="block text-sm">
                  <span className="rotulo">Resolução da impressora</span>
                  <select name="dpi" defaultValue="203" className="campo">
                    <option value="203">203 dpi (8 pontos/mm)</option>
                    <option value="300">300 dpi (12 pontos/mm)</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="rotulo">Quantidade de etiquetas</span>
                  <input name="copias" type="number" min={1} max={9999} defaultValue={r.ordem?.quantidadeSacasProduzidas ?? 1} className="campo" />
                </label>
                <button className="btn-primario w-full">Baixar arquivo ZPL</button>
              </form>
            ) : (
              <p className="text-sm text-slate-600">{r.aprovada ? "Seu perfil não emite etiquetas." : "Aprove a fórmula para liberar a impressão."}</p>
            )}
            <p className="text-xs text-slate-500">
              Envie o .zpl para a Zebra pelo Zebra Setup Utilities, pela porta 9100 da impressora ou abra no ZebraDesigner. Para impressoras comuns, use a impressão do navegador (Ctrl+P), já ajustada ao tamanho da etiqueta.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
