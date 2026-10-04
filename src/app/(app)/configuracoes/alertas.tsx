"use client";
import { useState, useTransition } from "react";
import { Alerta } from "@/components/ui";
import { acaoTestarAlertas } from "./actions";

export function BotaoTestarAlertas() {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendente}
        className="btn-secundario"
        onClick={() =>
          iniciar(async () => {
            const r = await acaoTestarAlertas();
            setMsg(r.ok ? { ok: true, texto: r.dados ? `${r.dados} envio(s) registrado(s).` : "Nada pendente hoje: nenhum alerta enviado." } : { ok: false, texto: r.erro });
          })
        }
      >
        {pendente ? "Enviando…" : "Enviar resumo agora"}
      </button>
      {msg && <Alerta tipo={msg.ok ? "sucesso" : "erro"}>{msg.texto}</Alerta>}
    </div>
  );
}
