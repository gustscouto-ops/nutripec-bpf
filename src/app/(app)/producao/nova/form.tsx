"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Turno } from "@prisma/client";
import { Assinatura } from "@/components/assinatura";
import { Alerta, Campo } from "@/components/ui";
import { acaoRegistrarOrdem } from "../actions";

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  versao: number;
  bateladaKg: number;
  sacariaKg: number;
  itens: { materiaPrimaId: string; nome: string; kgBatelada: number }[];
};
type Lote = { id: string; materiaPrimaId: string; codigo: string; fornecedor: string; dataValidade: string | null; saldoKg: number };
type Consumo = { materiaPrimaId: string; loteId: string; kg: string };

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Sugere os lotes por FEFO/FIFO (a lista já vem ordenada), quebrando entre lotes se faltar saldo. */
function sugerir(p: Produto, bateladas: number, lotes: Lote[]): Consumo[] {
  const out: Consumo[] = [];
  for (const item of p.itens) {
    let falta = r3(item.kgBatelada * bateladas);
    const disponiveis = lotes.filter((l) => l.materiaPrimaId === item.materiaPrimaId);
    for (const l of disponiveis) {
      if (falta <= 0) break;
      const usar = Math.min(falta, l.saldoKg);
      out.push({ materiaPrimaId: item.materiaPrimaId, loteId: l.id, kg: String(r3(usar)) });
      falta = r3(falta - usar);
    }
    if (falta > 0 || !disponiveis.length) out.push({ materiaPrimaId: item.materiaPrimaId, loteId: "", kg: String(falta) });
  }
  return out;
}

export function FormOrdem({ produtos, lotes, tolerancia, usuario, pendentes }: { produtos: Produto[]; lotes: Lote[]; tolerancia: number; usuario: string; pendentes: number }) {
  const router = useRouter();
  const [produtoId, setProdutoId] = useState("");
  const [bateladas, setBateladas] = useState("1");
  const [turno, setTurno] = useState<Turno>("MANHA");
  const [misturador, setMisturador] = useState("");
  const [sacas, setSacas] = useState("");
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const produto = produtos.find((p) => p.id === produtoId);
  const nBat = Math.max(0, Math.floor(Number(bateladas) || 0));

  function escolherProduto(id: string) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    setConsumos(p && nBat ? sugerir(p, nBat, lotes) : []);
  }
  function mudarBateladas(v: string) {
    setBateladas(v);
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (produto && n) setConsumos(sugerir(produto, n, lotes));
  }

  const resumo = useMemo(() => {
    if (!produto) return [];
    return produto.itens.map((i) => {
      const previsto = r3(i.kgBatelada * nBat);
      const dosado = r3(consumos.filter((c) => c.materiaPrimaId === i.materiaPrimaId && c.loteId).reduce((s, c) => s + (Number(c.kg) || 0), 0));
      const desvio = previsto ? ((dosado - previsto) / previsto) * 100 : 0;
      return { ...i, previsto, dosado, desvio };
    });
  }, [produto, consumos, nBat]);
  const foraTolerancia = resumo.filter((r) => Math.abs(r.desvio) > tolerancia);
  const semLote = consumos.some((c) => !c.loteId);
  const sacasCalc = produto ? Math.floor((produto.bateladaKg * nBat) / produto.sacariaKg) : 0;

  function assinar(senha: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acaoRegistrarOrdem(
        {
          produtoId,
          turno,
          misturador,
          numeroBateladas: nBat,
          quantidadeSacas: sacas ? Number(sacas) : null,
          dataValidade: validade || null,
          observacoes,
          consumos: consumos.filter((c) => c.loteId).map((c) => ({ loteMateriaPrimaId: c.loteId, quantidadeKg: Number(c.kg) })),
        },
        senha,
      );
      if (!r.ok) return setErro(r.erro);
      router.push(`/producao/${r.dados!.id}?novo=1`);
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div>
        <div className="text-xs font-semibold tracking-wide text-marca-700 uppercase">POP 07 · RQ 7.1 — Sequenciamento de bateladas</div>
        <h1 className="text-2xl font-bold">Nova ordem de produção</h1>
      </div>
      {pendentes > 0 && <Alerta tipo="aviso">{pendentes} produto(s) não aparecem porque a fórmula ainda não foi aprovada pelo RT.</Alerta>}

      <section className="cartao grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Produto (fórmula aprovada) *">
            <select value={produtoId} onChange={(e) => escolherProduto(e.target.value)} className="campo">
              <option value="">Selecione…</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome} (fórmula v{p.versao})</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Número de bateladas *" ajuda={produto ? `${produto.bateladaKg} kg por batelada` : undefined}>
          <input value={bateladas} onChange={(e) => mudarBateladas(e.target.value)} inputMode="numeric" className="campo" />
        </Campo>
        <Campo rotulo="Turno">
          <select value={turno} onChange={(e) => setTurno(e.target.value as Turno)} className="campo">
            <option value="MANHA">Manhã</option>
            <option value="TARDE">Tarde</option>
            <option value="NOITE">Noite</option>
          </select>
        </Campo>
        <Campo rotulo="Misturador"><input value={misturador} onChange={(e) => setMisturador(e.target.value)} className="campo" placeholder="Ex.: Misturador horizontal 1 t" /></Campo>
        <Campo rotulo="Sacas produzidas" ajuda={produto ? `Calculado: ${sacasCalc} sacas de ${produto.sacariaKg} kg` : undefined}>
          <input value={sacas} onChange={(e) => setSacas(e.target.value)} inputMode="numeric" placeholder={String(sacasCalc || "")} className="campo" />
        </Campo>
        <Campo rotulo="Validade do produto"><input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="campo" /></Campo>
      </section>

      {produto && (
        <section className="cartao">
          <h2 className="font-semibold">Lotes de matéria-prima dosados</h2>
          <p className="mb-3 text-sm text-slate-600">Sugestão automática por validade/ordem de chegada (FEFO). Ajuste se o operador usou outro lote.</p>
          <div className="space-y-4">
            {resumo.map((item) => {
              const linhas = consumos.map((c, idx) => ({ c, idx })).filter(({ c }) => c.materiaPrimaId === item.materiaPrimaId);
              const opcoes = lotes.filter((l) => l.materiaPrimaId === item.materiaPrimaId);
              const fora = Math.abs(item.desvio) > tolerancia;
              return (
                <div key={item.materiaPrimaId} className={`rounded-lg border p-3 ${fora ? "border-amber-400 bg-amber-50/50" : "border-slate-200"}`}>
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold">{item.nome}</span>
                    <span className="tabular-nums">
                      previsto {item.previsto} kg · dosado {item.dosado} kg{" "}
                      <span className={fora ? "font-semibold text-amber-800" : "text-slate-500"}>({item.desvio >= 0 ? "+" : ""}{item.desvio.toFixed(2)}%)</span>
                    </span>
                  </div>
                  {linhas.map(({ c, idx }) => (
                    <div key={idx} className="mb-2 grid grid-cols-[1fr_8rem_auto] gap-2">
                      <select value={c.loteId} onChange={(e) => setConsumos(consumos.map((x, j) => (j === idx ? { ...x, loteId: e.target.value } : x)))} className={`campo ${!c.loteId ? "border-red-400" : ""}`}>
                        <option value="">{opcoes.length ? "Selecione o lote…" : "Sem lote liberado com saldo"}</option>
                        {opcoes.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.codigo} · saldo {l.saldoKg} kg{l.dataValidade ? ` · val. ${new Date(l.dataValidade).toLocaleDateString("pt-BR")}` : ""}
                          </option>
                        ))}
                      </select>
                      <input value={c.kg} onChange={(e) => setConsumos(consumos.map((x, j) => (j === idx ? { ...x, kg: e.target.value.replace(",", ".") } : x)))} inputMode="decimal" className="campo text-right" />
                      <button type="button" onClick={() => setConsumos(consumos.filter((_, j) => j !== idx))} className="btn-secundario px-3" aria-label="Remover">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setConsumos([...consumos, { materiaPrimaId: item.materiaPrimaId, loteId: "", kg: "0" }])} className="text-sm font-medium text-marca-700">
                    + outro lote
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {produto && (
        <section className="cartao">
          <Campo rotulo={foraTolerancia.length ? "Observações * (justifique o desvio de formulação)" : "Observações"}>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="campo" />
          </Campo>
          {foraTolerancia.length > 0 && (
            <p className="mt-2 text-sm text-amber-800">
              Desvio acima de {tolerancia}% em: {foraTolerancia.map((f) => f.nome).join(", ")}.
            </p>
          )}
        </section>
      )}

      {erro && <Alerta>{erro}</Alerta>}
      {produto && nBat > 0 && (
        semLote ? (
          <Alerta tipo="aviso">Selecione o lote de todas as matérias-primas antes de assinar.</Alerta>
        ) : (
          <Assinatura
            declaracao={`Eu, ${usuario}, declaro que produzi ${nBat} batelada(s) de ${produto.nome} com os lotes de matéria-prima acima.`}
            rotuloBotao="Assinar ordem de produção"
            pendente={pendente}
            onAssinar={assinar}
          />
        )
      )}
    </div>
  );
}
