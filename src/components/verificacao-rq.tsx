"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acaoVerificarRq } from "@/app/(app)/rqs/actions";
import { Assinatura } from "./assinatura";
import { Alerta } from "./ui";

/** Segunda assinatura do RQ (verificador), com parecer obrigatório quando houve não conformidade. */
export function VerificarRq({ rqId, naoConforme }: { rqId: string; naoConforme: boolean }) {
  const router = useRouter();
  const [parecer, setParecer] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Parecer da verificação{naoConforme ? " (obrigatório: houve não conformidade)" : " (opcional)"}
        <textarea
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          rows={2}
          className="campo mt-1"
          placeholder={naoConforme ? "Ex.: ação corretiva conferida, produto segregado, medida preventiva definida na NC." : "Ex.: conferido na inspeção da área."}
        />
      </label>
      {erro && <Alerta>{erro}</Alerta>}
      <Assinatura
        titulo="Assinatura do verificador"
        declaracao="Declaro que conferi este registro e as ações tomadas, conforme o POP (IN MAPA 04/2007, item 7.15)."
        rotuloBotao="Verificar e assinar"
        pendente={pendente}
        onAssinar={(senha) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoVerificarRq(rqId, senha, parecer);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          })
        }
      />
    </div>
  );
}
