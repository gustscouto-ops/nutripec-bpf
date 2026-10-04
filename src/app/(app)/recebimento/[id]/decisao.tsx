"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Assinatura } from "@/components/assinatura";
import { Alerta, Campo } from "@/components/ui";
import { acaoDecidirLote } from "../actions";

export function DecisaoRt({ loteId, nomeUsuario }: { loteId: string; nomeUsuario: string }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState<"LIBERADO" | "REPROVADO">("REPROVADO");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <section className="cartao space-y-4 border-amber-300">
      <div>
        <h2 className="font-semibold">Decisão do RT sobre o lote em quarentena</h2>
        <p className="text-sm text-slate-600">Avalie as não conformidades e decida o destino da carga.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDecisao("LIBERADO")} className={`btn border-2 ${decisao === "LIBERADO" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white"}`}>
          Liberar com ressalva
        </button>
        <button type="button" onClick={() => setDecisao("REPROVADO")} className={`btn border-2 ${decisao === "REPROVADO" ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white"}`}>
          Reprovar / devolver
        </button>
      </div>
      <Campo rotulo="Justificativa técnica *">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="campo" placeholder="Ex.: após secagem, umidade em 13,1% (laudo anexo)…" />
      </Campo>
      {erro && <Alerta>{erro}</Alerta>}
      <Assinatura
        titulo="Assinatura do Responsável Técnico"
        declaracao={`Eu, ${nomeUsuario}, ${decisao === "LIBERADO" ? "libero o uso deste lote com a justificativa acima" : "reprovo este lote, que não poderá ser usado na produção"}.`}
        rotuloBotao={decisao === "LIBERADO" ? "Assinar liberação" : "Assinar reprovação"}
        perigo={decisao === "REPROVADO"}
        pendente={pendente}
        onAssinar={(senha) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoDecidirLote(loteId, decisao, motivo, senha);
            if (!r.ok) setErro(r.erro);
            else router.refresh();
          })
        }
      />
    </section>
  );
}
