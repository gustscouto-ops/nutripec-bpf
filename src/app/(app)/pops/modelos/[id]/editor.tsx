"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Frequencia } from "@prisma/client";
import type { CampoRq, TipoCampo } from "@/lib/rq/campos";
import { Alerta, Campo } from "@/components/ui";
import { acaoSalvarModelo } from "../../actions";

type Item = Partial<CampoRq> & { chave: string };
type Inicial = { titulo: string; frequencia: Frequencia; diaSemana: number | null; diaMes: number | null; ativo: boolean; campos: CampoRq[] };

const FREQ: [Frequencia, string][] = [
  ["DIARIA", "Diária"],
  ["SEMANAL", "Semanal"],
  ["QUINZENAL", "Quinzenal"],
  ["MENSAL", "Mensal"],
  ["SEMESTRAL", "Semestral"],
  ["ANUAL", "Anual"],
  ["QUANDO_OCORRE", "Quando ocorre"],
];
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TIPOS: [TipoCampo, string][] = [
  ["conformidade", "Conforme / Não conforme"],
  ["numerico", "Medição (número)"],
  ["texto", "Texto livre"],
];

let seq = 0;
const nova = (c: Partial<CampoRq> = {}): Item => ({ ...c, chave: `k${++seq}` });

export function EditorModelo({ id, inicial, recebimento, salvo }: { id: string; inicial: Inicial; recebimento: boolean; salvo?: string }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [frequencia, setFrequencia] = useState<Frequencia>(inicial.frequencia);
  const [diaSemana, setDiaSemana] = useState(inicial.diaSemana ?? 5);
  const [diaMes, setDiaMes] = useState(inicial.diaMes ?? 28);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [itens, setItens] = useState<Item[]>(() => inicial.campos.map((c) => nova(c)));
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(salvo ? `Formulário salvo (v${salvo}). A empresa agora usa a versão própria deste RQ.` : null);
  const [pendente, iniciar] = useTransition();

  const alterar = (i: number, p: Partial<CampoRq>) => setItens(itens.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const mover = (i: number, d: number) => {
    const n = [...itens];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setItens(n);
  };

  function salvar() {
    setErro(null);
    setOk(null);
    iniciar(async () => {
      const r = await acaoSalvarModelo(id, {
        titulo,
        frequencia,
        diaSemana: frequencia === "SEMANAL" || frequencia === "QUINZENAL" ? diaSemana : null,
        diaMes: ["MENSAL", "SEMESTRAL", "ANUAL"].includes(frequencia) ? diaMes : null,
        ativo,
        campos: itens.map(({ chave: _, ...c }) => c),
      });
      if (!r.ok) return setErro(r.erro);
      if (r.dados!.id !== id) return router.replace(`/pops/modelos/${r.dados!.id}?salvo=${r.dados!.versao}`);
      setOk(`Formulário salvo (v${r.dados!.versao}).`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="cartao grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Título do registro">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" />
        </Campo>
        <Campo rotulo="Frequência" ajuda={recebimento ? "O recebimento acontece a cada carga." : "Define a agenda de tarefas e os alertas de atraso."}>
          <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)} className="campo" disabled={recebimento}>
            {FREQ.map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
        {(frequencia === "SEMANAL" || frequencia === "QUINZENAL") && (
          <Campo rotulo="Prazo na semana">
            <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="campo">
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  Até {d.toLowerCase()}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {["MENSAL", "SEMESTRAL", "ANUAL"].includes(frequencia) && (
          <Campo rotulo="Prazo: até o dia do mês">
            <input type="number" min={1} max={28} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} className="campo" />
          </Campo>
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-5 w-5" disabled={recebimento} />
          RQ ativo (aparece na agenda de tarefas)
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Itens de verificação</h2>
        {itens.map((c, i) => (
          <div key={c.chave} className="cartao space-y-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 w-6 text-sm font-semibold text-slate-500">{i + 1}.</span>
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_14rem]">
                <input value={c.rotulo ?? ""} onChange={(e) => alterar(i, { rotulo: e.target.value })} placeholder="Pergunta / item verificado" className="campo" aria-label={`Item ${i + 1}`} />
                <select value={c.tipo ?? "conformidade"} onChange={(e) => alterar(i, { tipo: e.target.value as TipoCampo })} className="campo" aria-label={`Tipo do item ${i + 1}`}>
                  {TIPOS.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 pl-8 sm:grid-cols-4">
              {c.tipo === "numerico" && (
                <>
                  <input value={c.unidade ?? ""} onChange={(e) => alterar(i, { unidade: e.target.value })} placeholder="Unidade (ex.: °C)" className="campo" />
                  <input type="number" value={c.min ?? ""} onChange={(e) => alterar(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Mínimo" className="campo" />
                  <input type="number" value={c.max ?? ""} onChange={(e) => alterar(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Máximo" className="campo" />
                </>
              )}
              <input value={c.ajuda ?? ""} onChange={(e) => alterar(i, { ajuda: e.target.value })} placeholder="Orientação ao operador (opcional)" className={`campo ${c.tipo === "numerico" ? "" : "sm:col-span-3"}`} />
            </div>
            <div className="flex flex-wrap items-center gap-4 pl-8 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={c.obrigatorio !== false} onChange={(e) => alterar(i, { obrigatorio: e.target.checked ? undefined : false })} />
                Obrigatório
              </label>
              {c.limiteDinamico && <span className="text-xs text-slate-500">Limite vem do cadastro da matéria-prima</span>}
              <span className="flex-1" />
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="link disabled:opacity-30">
                ↑ Subir
              </button>
              <button type="button" disabled={i === itens.length - 1} onClick={() => mover(i, 1)} className="link disabled:opacity-30">
                ↓ Descer
              </button>
              <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="font-medium text-red-600">
                Remover
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItens([...itens, nova({ tipo: "conformidade", rotulo: "" })])} className="btn-secundario w-full">
          + Adicionar item
        </button>
      </section>

      {erro && <Alerta>{erro}</Alerta>}
      {ok && <Alerta tipo="sucesso">{ok}</Alerta>}
      <button type="button" onClick={salvar} disabled={pendente} className="btn-primario w-full">
        Salvar formulário
      </button>
    </div>
  );
}
