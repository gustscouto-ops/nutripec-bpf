"use client";
import { useState } from "react";
import { Alerta } from "@/components/ui";

/** Baixa o ZIP pelo navegador, com aviso de progresso (o pacote pode levar alguns segundos). */
export function BotaoGerarDossie({ inicio, fim }: { inicio: string; fim: string }) {
  const [estado, setEstado] = useState<"pronto" | "gerando" | "ok" | string>("pronto");
  async function gerar() {
    setEstado("gerando");
    try {
      const r = await fetch(`/api/dossie?inicio=${inicio}&fim=${fim}`);
      if (!r.ok) throw new Error((await r.text()) || "Falha ao gerar o dossiê.");
      const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "dossie.zip";
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: nome });
      a.click();
      URL.revokeObjectURL(url);
      setEstado("ok");
    } catch (e) {
      setEstado((e as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={gerar} disabled={estado === "gerando"} className="btn-primario">
        {estado === "gerando" ? "Gerando pacote…" : "Gerar dossiê (ZIP)"}
      </button>
      {estado === "ok" && <Alerta tipo="sucesso">Dossiê baixado. A geração ficou registrada na trilha de auditoria.</Alerta>}
      {!["pronto", "gerando", "ok"].includes(estado) && <Alerta>{estado}</Alerta>}
    </div>
  );
}
