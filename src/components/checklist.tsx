"use client";
import { faixaDoCampo, respostaNaoConforme, type CampoRq, type Limites, type Respostas } from "@/lib/rq/campos";

/** Renderiza qualquer RQ a partir da definição de campos (motor de formulários). */
export function Checklist({
  campos,
  respostas,
  onChange,
  limites,
  erros,
}: {
  campos: CampoRq[];
  respostas: Respostas;
  onChange: (r: Respostas) => void;
  limites?: Limites;
  erros?: Record<string, string>;
}) {
  const set = (id: string, patch: Partial<Respostas[string]>) => onChange({ ...respostas, [id]: { ...respostas[id], ...patch } });

  return (
    <ol className="space-y-3">
      {campos.map((c, i) => {
        const r = respostas[c.id] ?? {};
        const nc = respostaNaoConforme(c, r, limites);
        const faixa = faixaDoCampo(c, limites);
        const erro = erros?.[c.id];
        return (
          <li key={c.id} className={`rounded-xl border bg-white p-3 sm:p-4 ${nc ? "border-red-400 bg-red-50/40" : erro ? "border-amber-400" : "border-slate-200"}`}>
            <div className="mb-2 flex gap-2 font-medium">
              <span className="text-slate-400">{i + 1}.</span>
              <span>{c.rotulo}</span>
            </div>

            {c.tipo === "conformidade" && (
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["C", "Conforme", "bg-emerald-600 text-white border-emerald-600"],
                    ["NC", "Não conforme", "bg-red-600 text-white border-red-600"],
                    ["NA", "N/A", "bg-slate-600 text-white border-slate-600"],
                  ] as const
                ).map(([v, rot, ativo]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set(c.id, { valor: v })}
                    className={`min-h-12 rounded-lg border-2 px-2 text-sm font-semibold transition ${r.valor === v ? ativo : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                  >
                    {rot}
                  </button>
                ))}
              </div>
            )}

            {c.tipo === "numerico" && (
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={r.valor === undefined || r.valor === null ? "" : String(r.valor)}
                  onChange={(e) => set(c.id, { valor: e.target.value.replace(",", ".") })}
                  className="campo max-w-40 text-lg tabular-nums"
                />
                <span className="text-slate-600">{c.unidade}</span>
                <span className="text-xs text-slate-500">
                  {faixa.min !== undefined && faixa.max !== undefined && faixa.max !== null
                    ? `faixa ${faixa.min} a ${faixa.max}`
                    : faixa.max !== undefined && faixa.max !== null
                      ? `máx. ${faixa.max}`
                      : faixa.min !== undefined
                        ? `mín. ${faixa.min}`
                        : ""}
                </span>
              </div>
            )}

            {c.tipo === "texto" && (
              <textarea value={String(r.valor ?? "")} onChange={(e) => set(c.id, { valor: e.target.value })} rows={2} className="campo" />
            )}

            {nc && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label>
                  <span className="rotulo text-red-800">Descreva o ocorrido *</span>
                  <textarea value={r.descricaoNc ?? ""} onChange={(e) => set(c.id, { descricaoNc: e.target.value })} rows={2} className="campo" />
                </label>
                <label>
                  <span className="rotulo text-red-800">Ação corretiva imediata *</span>
                  <textarea value={r.acaoCorretiva ?? ""} onChange={(e) => set(c.id, { acaoCorretiva: e.target.value })} rows={2} className="campo" />
                </label>
              </div>
            )}
            {erro && <p className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
          </li>
        );
      })}
    </ol>
  );
}
