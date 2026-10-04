"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PassoIt } from "@/lib/rq/instrucoes";
import { Alerta, Campo } from "@/components/ui";
import { acaoSalvarIt } from "@/app/(app)/pops/actions";

type Inicial = { titulo: string; objetivo: string; ativo: boolean; passos: PassoIt[] };

export function EditorIt({ id, inicial }: { id: string; inicial: Inicial }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [objetivo, setObjetivo] = useState(inicial.objetivo);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [passos, setPassos] = useState<PassoIt[]>(inicial.passos);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const alterar = (i: number, p: Partial<PassoIt>) => setPassos(passos.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const mover = (i: number, d: number) => {
    const n = [...passos];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setPassos(n);
  };

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await acaoSalvarIt(id, { titulo, objetivo, ativo, passos });
      if (!r.ok) return setErro(r.erro);
      router.push(`/instrucoes/${r.dados!.id}`);
    });
  }

  return (
    <div className="space-y-4 pb-10">
      <section className="cartao space-y-4">
        <Campo rotulo="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" />
        </Campo>
        <Campo rotulo="Objetivo">
          <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} className="campo" />
        </Campo>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-5 w-5" />
          Instrução ativa
        </label>
      </section>
      <h2 className="font-semibold">Passos</h2>
      {passos.map((p, i) => (
        <div key={i} className="cartao space-y-2">
          <div className="flex gap-2">
            <span className="mt-2.5 w-6 text-sm font-semibold text-slate-500">{i + 1}.</span>
            <textarea value={p.texto} onChange={(e) => alterar(i, { texto: e.target.value })} rows={2} className="campo" aria-label={`Passo ${i + 1}`} />
          </div>
          <div className="pl-8">
            <input value={p.alerta ?? ""} onChange={(e) => alterar(i, { alerta: e.target.value })} placeholder="Alerta de segurança ou qualidade (opcional)" className="campo" />
          </div>
          <div className="flex justify-end gap-4 text-sm">
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="link disabled:opacity-30">
              ↑ Subir
            </button>
            <button type="button" disabled={i === passos.length - 1} onClick={() => mover(i, 1)} className="link disabled:opacity-30">
              ↓ Descer
            </button>
            <button type="button" onClick={() => setPassos(passos.filter((_, j) => j !== i))} className="font-medium text-red-600">
              Remover
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setPassos([...passos, { texto: "" }])} className="btn-secundario w-full">
        + Adicionar passo
      </button>
      {erro && <Alerta>{erro}</Alerta>}
      <button type="button" onClick={salvar} disabled={pendente} className="btn-primario w-full">
        Salvar instrução
      </button>
    </div>
  );
}
