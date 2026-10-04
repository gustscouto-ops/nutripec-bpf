"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acaoAprovarFormula, acaoSalvarProduto } from "../actions";
import { Alerta, Campo } from "@/components/ui";
import { Assinatura } from "@/components/assinatura";
import type { NivelGarantia } from "@/lib/servicos/formula";

export type ProdutoEditor = {
  id: string;
  codigo: string;
  nome: string;
  especieDestino: string | null;
  categoria: string | null;
  tipoEmbalagem: string | null;
  pesoSacariaKg: number;
  tamanhoBateladaKg: number;
  modeloEtiqueta: string | null;
  indicacaoUso: string | null;
  modoUso: string | null;
  composicaoBasica: string | null;
  substitutivos: string | null;
  restricoes: string | null;
  niveisGarantia: NivelGarantia[];
  statusFormula: "RASCUNHO" | "AGUARDANDO_RT" | "APROVADA";
  itens: { materiaPrimaId: string; percentual: number; quantidadeBateladaKg: number }[];
};

type Linha = { materiaPrimaId: string; percentual: string; kg: string };
const fmt = (n: number, c = 3) => (Number.isFinite(n) ? String(Math.round(n * 10 ** c) / 10 ** c) : "");
const n = (s: string) => Number(String(s).replace(",", "."));

export function EditorProduto({
  id,
  inicial,
  mps,
  podeEditar,
  podeAprovar,
  nomeUsuario,
}: {
  id: string | null;
  inicial: ProdutoEditor | null;
  mps: { id: string; nomeComercial: string }[];
  podeEditar: boolean;
  podeAprovar: boolean;
  nomeUsuario: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [dados, setDados] = useState({
    codigo: inicial?.codigo ?? "",
    nome: inicial?.nome ?? "",
    especieDestino: inicial?.especieDestino ?? "",
    categoria: inicial?.categoria ?? "",
    tipoEmbalagem: inicial?.tipoEmbalagem ?? "",
    pesoSacariaKg: String(inicial?.pesoSacariaKg ?? 25),
    modeloEtiqueta: inicial?.modeloEtiqueta ?? "",
    indicacaoUso: inicial?.indicacaoUso ?? "",
    modoUso: inicial?.modoUso ?? "",
    composicaoBasica: inicial?.composicaoBasica ?? "",
    substitutivos: inicial?.substitutivos ?? "",
    restricoes: inicial?.restricoes ?? "",
  });
  const [batelada, setBatelada] = useState(String(inicial?.tamanhoBateladaKg ?? 1000));
  const [base, setBase] = useState<"percentual" | "batelada">("percentual");
  const [linhas, setLinhas] = useState<Linha[]>(
    inicial?.itens.map((i) => ({ materiaPrimaId: i.materiaPrimaId, percentual: fmt(i.percentual, 4), kg: fmt(i.quantidadeBateladaKg) })) ?? [
      { materiaPrimaId: "", percentual: "", kg: "" },
    ],
  );
  const [niveis, setNiveis] = useState<NivelGarantia[]>(inicial?.niveisGarantia ?? []);
  const [alterado, setAlterado] = useState(false);

  const set = (k: keyof typeof dados) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDados({ ...dados, [k]: e.target.value });
    setAlterado(true);
  };

  const totalPct = useMemo(() => linhas.reduce((s, l) => s + (n(l.percentual) || 0), 0), [linhas]);
  const totalKg = useMemo(() => linhas.reduce((s, l) => s + (n(l.kg) || 0), 0), [linhas]);
  const fecha = Math.abs(totalPct - 100) <= 0.01;

  function alterarLinha(i: number, campo: keyof Linha, valor: string) {
    const b = n(batelada) || 0;
    setLinhas((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const nova = { ...l, [campo]: valor };
        if (campo === "percentual") nova.kg = fmt((n(valor) / 100) * b);
        if (campo === "kg") nova.percentual = fmt(b ? (n(valor) / b) * 100 : 0, 4);
        return nova;
      }),
    );
    if (campo !== "materiaPrimaId") setBase(campo === "kg" ? "batelada" : "percentual");
    setAlterado(true);
  }

  function alterarBatelada(v: string) {
    setBatelada(v);
    const b = n(v) || 0;
    setLinhas((ls) => ls.map((l) => (base === "percentual" ? { ...l, kg: fmt((n(l.percentual) / 100) * b) } : { ...l, percentual: fmt(b ? (n(l.kg) / b) * 100 : 0, 4) })));
    setAlterado(true);
  }

  function salvar() {
    setMsg(null);
    iniciar(async () => {
      const r = await acaoSalvarProduto(id, {
        ...dados,
        pesoSacariaKg: n(dados.pesoSacariaKg),
        tamanhoBateladaKg: n(batelada),
        niveisGarantia: niveis.map((x) => ({ ...x, valor: Number(x.valor) })),
        base,
        itens: linhas.map((l) => ({ materiaPrimaId: l.materiaPrimaId, percentual: n(l.percentual), quantidadeBateladaKg: n(l.kg) })),
      });
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
      setAlterado(false);
      setMsg({ tipo: "sucesso", texto: inicial?.statusFormula === "APROVADA" ? "Salvo como nova versão. A fórmula voltou para rascunho e precisa de nova aprovação do RT." : "Produto salvo." });
      if (!id) router.push(`/produtos/${r.dados}`);
      else router.refresh();
    });
  }

  function aprovar(senha: string) {
    setMsg(null);
    iniciar(async () => {
      const r = await acaoAprovarFormula(id!, senha);
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "sucesso", texto: "Fórmula aprovada e assinada eletronicamente. Produção liberada." });
      router.refresh();
    });
  }

  const nomeMp = (mid: string) => mps.find((m) => m.id === mid)?.nomeComercial ?? "";

  return (
    <div className="space-y-6">
      <fieldset disabled={!podeEditar} className="space-y-6">
        <section className="cartao grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Código *"><input value={dados.codigo} onChange={set("codigo")} className="campo font-mono uppercase" /></Campo>
          <div className="sm:col-span-2"><Campo rotulo="Nome do produto *"><input value={dados.nome} onChange={set("nome")} className="campo" /></Campo></div>
          <Campo rotulo="Espécie de destino"><input value={dados.especieDestino} onChange={set("especieDestino")} className="campo" /></Campo>
          <Campo rotulo="Categoria"><input value={dados.categoria} onChange={set("categoria")} className="campo" placeholder="Ração, concentrado, núcleo…" /></Campo>
          <Campo rotulo="Tipo de embalagem"><input value={dados.tipoEmbalagem} onChange={set("tipoEmbalagem")} className="campo" /></Campo>
          <Campo rotulo="Peso da sacaria (kg) *"><input value={dados.pesoSacariaKg} onChange={set("pesoSacariaKg")} inputMode="decimal" className="campo" /></Campo>
          <Campo rotulo="Tamanho da batelada (kg do misturador) *"><input value={batelada} onChange={(e) => alterarBatelada(e.target.value)} inputMode="decimal" className="campo" /></Campo>
          <Campo rotulo="Modelo de etiqueta"><input value={dados.modeloEtiqueta} onChange={set("modeloEtiqueta")} className="campo" /></Campo>
        </section>

        <section className="cartao">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Fórmula</h2>
            <span className="text-sm text-slate-600">Digite em % ou em kg da batelada; o outro valor é calculado.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Matéria-prima</th>
                  <th className="w-36">Inclusão (%)</th>
                  <th className="w-40">kg / batelada</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i}>
                    <td className="pt-4 text-slate-500">{i + 1}</td>
                    <td>
                      <select value={l.materiaPrimaId} onChange={(e) => alterarLinha(i, "materiaPrimaId", e.target.value)} className="campo">
                        <option value="">Selecione…</option>
                        {mps.map((m) => (
                          <option key={m.id} value={m.id} disabled={linhas.some((x, j) => j !== i && x.materiaPrimaId === m.id)}>
                            {m.nomeComercial}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td><input value={l.percentual} onChange={(e) => alterarLinha(i, "percentual", e.target.value)} inputMode="decimal" className="campo text-right tabular-nums" /></td>
                    <td><input value={l.kg} onChange={(e) => alterarLinha(i, "kg", e.target.value)} inputMode="decimal" className="campo text-right tabular-nums" /></td>
                    <td>
                      <button type="button" onClick={() => { setLinhas(linhas.filter((_, j) => j !== i)); setAlterado(true); }} className="btn-secundario px-3" aria-label="Remover">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td />
                  <td className="px-3 py-2">Total</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${fecha ? "text-emerald-700" : "text-red-600"}`}>{fmt(totalPct, 4)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalKg)} kg</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {!fecha && linhas.some((l) => l.percentual) && <p className="mt-2 text-sm text-red-600">A fórmula precisa fechar em 100% para ser aprovada pelo RT.</p>}
          <button type="button" onClick={() => setLinhas([...linhas, { materiaPrimaId: "", percentual: "", kg: "" }])} className="btn-secundario mt-3">
            + Adicionar ingrediente
          </button>
        </section>

        <section className="cartao">
          <h2 className="mb-3 font-semibold">Níveis de garantia</h2>
          <div className="space-y-2">
            {niveis.map((nv, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_6rem_auto] gap-2">
                <input value={nv.nutriente} placeholder="Ex.: Proteína Bruta (mín.)" onChange={(e) => { const x = [...niveis]; x[i] = { ...nv, nutriente: e.target.value }; setNiveis(x); setAlterado(true); }} className="campo" />
                <input value={String(nv.valor ?? "")} inputMode="decimal" onChange={(e) => { const x = [...niveis]; x[i] = { ...nv, valor: e.target.value as unknown as number }; setNiveis(x); setAlterado(true); }} className="campo text-right" />
                <input value={nv.unidade} onChange={(e) => { const x = [...niveis]; x[i] = { ...nv, unidade: e.target.value }; setNiveis(x); setAlterado(true); }} className="campo" />
                <button type="button" onClick={() => { setNiveis(niveis.filter((_, j) => j !== i)); setAlterado(true); }} className="btn-secundario px-3">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setNiveis([...niveis, { nutriente: "", valor: 0, unidade: "g/kg" }])} className="btn-secundario mt-3">
            + Adicionar nível
          </button>
        </section>

        <section className="cartao grid gap-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Rotulagem regulatória</h2>
          <Campo rotulo="Indicação de uso"><textarea value={dados.indicacaoUso} onChange={set("indicacaoUso")} rows={2} className="campo" /></Campo>
          <Campo rotulo="Modo de uso"><textarea value={dados.modoUso} onChange={set("modoUso")} rows={2} className="campo" /></Campo>
          <Campo rotulo="Composição básica"><textarea value={dados.composicaoBasica} onChange={set("composicaoBasica")} rows={3} className="campo" /></Campo>
          <Campo rotulo="Eventuais substitutivos"><textarea value={dados.substitutivos} onChange={set("substitutivos")} rows={3} className="campo" /></Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Restrições de uso / período de carência"><textarea value={dados.restricoes} onChange={set("restricoes")} rows={2} className="campo" /></Campo>
          </div>
        </section>
      </fieldset>

      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}

      {podeEditar && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={salvar} disabled={pendente} className="btn-primario">
            {pendente ? "Salvando…" : inicial?.statusFormula === "APROVADA" ? "Salvar como nova versão" : "Salvar"}
          </button>
          <a href="/produtos" className="btn-secundario">Voltar</a>
        </div>
      )}

      {id && inicial?.statusFormula !== "APROVADA" && (
        podeAprovar ? (
          alterado ? (
            <Alerta tipo="aviso">Salve as alterações antes de aprovar a fórmula.</Alerta>
          ) : (
            <Assinatura
              titulo="Aprovação da fórmula pelo Responsável Técnico"
              declaracao={`Eu, ${nomeUsuario}, declaro que revisei a formulação, os níveis de garantia e as informações de rotulagem deste produto e aprovo sua fabricação.`}
              rotuloBotao="Aprovar e assinar fórmula"
              pendente={pendente}
              onAssinar={aprovar}
            />
          )
        ) : (
          <Alerta tipo="aviso">Esta fórmula aguarda aprovação do Responsável Técnico. A produção fica bloqueada até lá.</Alerta>
        )
      )}

      {inicial && (
        <section className="cartao">
          <h2 className="mb-1 font-semibold">Espelho do rótulo</h2>
          <p className="mb-3 text-sm text-slate-600">Texto regulatório gerado a partir da fórmula e dos níveis de garantia (impressão Zebra/ZPL na Fase 3).</p>
          <div className="mx-auto max-w-md rounded-lg border-2 border-dashed border-slate-400 p-4 font-mono text-xs leading-relaxed">
            <div className="text-center text-sm font-bold">{dados.nome.toUpperCase()}</div>
            <div className="text-center">{dados.categoria} · {dados.especieDestino}</div>
            <div className="mt-2 font-bold">NÍVEIS DE GARANTIA (por kg do produto)</div>
            {niveis.map((nv, i) => <div key={i}>{nv.nutriente}: {String(nv.valor)} {nv.unidade}</div>)}
            <div className="mt-2 font-bold">COMPOSIÇÃO BÁSICA</div>
            <div>{dados.composicaoBasica || linhas.map((l) => nomeMp(l.materiaPrimaId)).filter(Boolean).join(", ")}</div>
            {dados.substitutivos && <><div className="mt-2 font-bold">EVENTUAIS SUBSTITUTIVOS</div><div>{dados.substitutivos}</div></>}
            {dados.indicacaoUso && <><div className="mt-2 font-bold">INDICAÇÃO DE USO</div><div>{dados.indicacaoUso}</div></>}
            {dados.modoUso && <><div className="mt-2 font-bold">MODO DE USO</div><div>{dados.modoUso}</div></>}
            {dados.restricoes && <><div className="mt-2 font-bold">RESTRIÇÕES / CARÊNCIA</div><div>{dados.restricoes}</div></>}
            <div className="mt-2">Peso líquido: {dados.pesoSacariaKg} kg · Lote e fabricação: ver embalagem</div>
          </div>
        </section>
      )}
    </div>
  );
}
