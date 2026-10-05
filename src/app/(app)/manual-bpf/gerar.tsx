"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/ui";

/** Gera o PDF no servidor (LibreOffice) e baixa pelo navegador, com aviso de progresso. */
export function BotaoGerarManual({ habilitado }: { habilitado: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"pronto" | "gerando" | "ok" | string>("pronto");
  async function gerar() {
    setEstado("gerando");
    try {
      const r = await fetch("/api/manual-bpf");
      if (!r.ok) throw new Error((await r.text()) || "Falha ao gerar o manual.");
      const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "manual-bpf.pdf";
      const url = URL.createObjectURL(await r.blob());
      Object.assign(document.createElement("a"), { href: url, download: nome }).click();
      URL.revokeObjectURL(url);
      setEstado("ok");
      router.refresh();
    } catch (e) {
      setEstado((e as Error).message);
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={gerar} disabled={!habilitado || estado === "gerando"} className="btn-primario">
        {estado === "gerando" ? "Gerando o PDF (pode levar até 30 s)…" : "Gerar PDF para impressão"}
      </button>
      {estado === "ok" && <Alerta tipo="sucesso">Manual baixado. A edição ficou no histórico abaixo.</Alerta>}
      {!["pronto", "gerando", "ok"].includes(estado) && <Alerta>{estado}</Alerta>}
    </div>
  );
}
