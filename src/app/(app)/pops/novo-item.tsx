"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Frequencia } from "@prisma/client";
import { Alerta } from "@/components/ui";
import { acaoCriarIt, acaoCriarModelo } from "./actions";

/** Criação de um RQ ou IT extra dentro de um POP (perfil RT/Consultor). */
export function NovoItem({ popId, numeroPop }: { popId: string; numeroPop: number }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"" | "rq" | "it">("");
  const [codigo, setCodigo] = useState(`RQ ${numeroPop}.`);
  const [titulo, setTitulo] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("MENSAL");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = tipo === "rq" ? await acaoCriarModelo({ popId, codigoRq: codigo, titulo, frequencia }) : await acaoCriarIt({ popId, titulo });
      if (!r.ok) return setErro(r.erro);
      router.push(tipo === "rq" ? `/pops/modelos/${r.dados!.id}` : `/instrucoes/${r.dados!.id}/editar`);
    });
  }

  if (!tipo)
    return (
      <div className="mt-3 flex gap-2 text-sm">
        <button type="button" onClick={() => setTipo("rq")} className="link">
          + Novo RQ
        </button>
        <button type="button" onClick={() => setTipo("it")} className="link">
          + Nova IT
        </button>
      </div>
    );
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-2">
        {tipo === "rq" && <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="campo w-28" aria-label="Código do RQ" />}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "rq" ? "Título do registro" : "Título da instrução"} className="campo min-w-48 flex-1" />
        {tipo === "rq" && (
          <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)} className="campo w-40" aria-label="Frequência">
            <option value="DIARIA">Diária</option>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINZENAL">Quinzenal</option>
            <option value="MENSAL">Mensal</option>
            <option value="SEMESTRAL">Semestral</option>
            <option value="ANUAL">Anual</option>
            <option value="QUANDO_OCORRE">Quando ocorre</option>
          </select>
        )}
      </div>
      {erro && <Alerta>{erro}</Alerta>}
      <div className="flex gap-2">
        <button type="button" onClick={criar} disabled={pendente} className="btn-primario min-h-9 py-1">
          Criar e editar
        </button>
        <button type="button" onClick={() => setTipo("")} className="btn-secundario min-h-9 py-1">
          Cancelar
        </button>
      </div>
    </div>
  );
}
