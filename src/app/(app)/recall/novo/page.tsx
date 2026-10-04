import Link from "next/link";
import { redirect } from "next/navigation";
import type { AlvoRecall } from "@prisma/client";
import { exigirCtx } from "@/lib/auth";
import { pode } from "@/lib/permissions";
import { buscarLotes } from "@/lib/servicos/rastreabilidade";
import { rastrearRecall } from "@/lib/servicos/recall";
import { ResultadoRecallView } from "@/components/resultado-recall";
import { Alerta, Cabecalho, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";
import { FormRecall } from "./form";

export const metadata = { title: "Novo simulado de recall" };

type Busca = { inicio?: string; q?: string; mp?: string; op?: string };

export default async function NovoRecall({ searchParams }: { searchParams: Promise<Busca> }) {
  const ctx = await exigirCtx();
  if (!pode(ctx.perfil, "recall:registrar")) return <Alerta>Somente o RT ou o consultor registram simulados e recolhimentos.</Alerta>;
  const sp = await searchParams;
  const inicio = Number(sp.inicio);
  if (!inicio) redirect(`/recall/novo?${new URLSearchParams({ ...(sp as Record<string, string>), inicio: String(Date.now()) })}`);
  const link = (extra: Record<string, string>) => `/recall/novo?${new URLSearchParams({ inicio: String(inicio), ...extra })}`;

  const alvo: { tipo: AlvoRecall; id: string } | null = sp.mp ? { tipo: "LOTE_MP", id: sp.mp } : sp.op ? { tipo: "LOTE_PRODUTO", id: sp.op } : null;
  const busca = !alvo && sp.q ? await buscarLotes(ctx.tenantId, sp.q) : null;
  let resultado = null;
  let erro: string | null = null;
  if (alvo) {
    try {
      resultado = await rastrearRecall(ctx.tenantId, alvo.tipo, alvo.id);
    } catch (e) {
      erro = (e as Error).message;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Cabecalho
        titulo="Simulado de recall"
        subtitulo={`Cronômetro iniciado em ${dataHora(new Date(inicio))}. O tempo até a assinatura vai para o RQ 8.1.`}
        acoes={
          <Link href="/recall" className="btn-secundario">
            Cancelar
          </Link>
        }
      />

      {!alvo && (
        <>
          <form className="cartao flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="inicio" value={inicio} />
            <input name="q" defaultValue={sp.q ?? ""} autoFocus placeholder="Lote suspeito: lote de produto, lote interno de MP, lote do fornecedor ou NF" className="campo text-lg" />
            <button className="btn-primario">Buscar</button>
          </form>
          {busca && (
            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h2 className="mb-2 font-semibold">Matéria-prima suspeita</h2>
                {busca.materiasPrimas.length ? (
                  <ul className="space-y-2">
                    {busca.materiasPrimas.map((l) => (
                      <li key={l.id}>
                        <Link href={link({ mp: l.id })} className="cartao block py-3 hover:border-marca-500">
                          <div className="font-mono font-semibold">{l.codigoLoteInterno}</div>
                          <div className="text-sm text-slate-600">
                            {l.materiaPrima.nomeComercial} · {l.fornecedor.razaoSocial} · NF {l.numeroNf}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio>Nenhum lote de matéria-prima encontrado.</Vazio>
                )}
              </section>
              <section>
                <h2 className="mb-2 font-semibold">Produto acabado reclamado</h2>
                {busca.produtos.length ? (
                  <ul className="space-y-2">
                    {busca.produtos.map((o) => (
                      <li key={o.id}>
                        <Link href={link({ op: o.id })} className="cartao block py-3 hover:border-marca-500">
                          <div className="font-mono font-semibold">{o.codigoLoteProduzido}</div>
                          <div className="text-sm text-slate-600">
                            {o.produto.codigo} · {o.produto.nome} · {dataHora(o.dataHoraInicio)}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio>Nenhum lote de produto encontrado.</Vazio>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {erro && <Alerta>{erro}</Alerta>}
      {resultado && alvo && (
        <>
          <section className="cartao">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{alvo.tipo === "LOTE_MP" ? "Matéria-prima suspeita" : "Produto reclamado (recolhimento ampliado pelos insumos em comum)"}</div>
            <div className="font-mono text-2xl font-bold">{resultado.alvo.codigo}</div>
            <div className="text-sm text-slate-600">{resultado.alvo.descricao}</div>
            <Link href={link({})} className="link mt-2 inline-block text-sm">
              Trocar o lote
            </Link>
          </section>
          <ResultadoRecallView r={resultado} />
          <FormRecall alvoTipo={alvo.tipo} alvoId={alvo.id} iniciadoEm={inicio} usuario={ctx.nome} />
        </>
      )}
    </div>
  );
}
