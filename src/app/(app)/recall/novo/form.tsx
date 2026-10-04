"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AlvoRecall, TipoRecall } from "@prisma/client";
import { Assinatura } from "@/components/assinatura";
import { Alerta, Campo } from "@/components/ui";
import { acaoRegistrarRecall } from "../actions";

export function FormRecall({ alvoTipo, alvoId, iniciadoEm, usuario }: { alvoTipo: AlvoRecall; alvoId: string; iniciadoEm: number; usuario: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoRecall>("SIMULADO");
  const [motivo, setMotivo] = useState("Simulado semestral do POP 08");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function assinar(senha: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acaoRegistrarRecall({ tipo, alvoTipo, alvoId, motivo, iniciadoEm }, senha);
      if (!r.ok) return setErro(r.erro);
      router.push(`/recall/${r.dados!.id}?novo=1`);
    });
  }

  return (
    <section id="assinar" className="cartao space-y-4">
      <h2 className="font-semibold">Concluir e assinar</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["SIMULADO", "Simulado", "Exercício do POP 08. Registra o RQ 8.1 do semestre, se ainda não houver."],
            ["REAL", "Recolhimento real", "Recall de verdade: o relatório lista clientes a notificar e estoque a bloquear."],
          ] as const
        ).map(([v, r, d]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setTipo(v);
              setMotivo(v === "SIMULADO" ? "Simulado semestral do POP 08" : "");
            }}
            className={`rounded-lg border-2 p-3 text-left ${tipo === v ? (v === "REAL" ? "border-red-600 bg-red-50" : "border-marca-600 bg-marca-50") : "border-slate-200"}`}
          >
            <div className="font-semibold">{r}</div>
            <div className="text-sm text-slate-600">{d}</div>
          </button>
        ))}
      </div>
      <Campo rotulo="Motivo *">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="campo" placeholder="Ex.: fornecedor comunicou contaminação do lote FOS-882" />
      </Campo>
      {erro && <Alerta>{erro}</Alerta>}
      <Assinatura
        declaracao={`Eu, ${usuario}, confirmo o rastreio acima e assino este ${tipo === "SIMULADO" ? "simulado de recall" : "recolhimento"}.`}
        rotuloBotao={tipo === "SIMULADO" ? "Assinar simulado" : "Assinar recolhimento"}
        perigo={tipo === "REAL"}
        pendente={pendente}
        onAssinar={assinar}
      />
    </section>
  );
}
