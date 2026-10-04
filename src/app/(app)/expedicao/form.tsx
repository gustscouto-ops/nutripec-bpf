"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta, Campo } from "@/components/ui";
import { acaoRegistrarExpedicao } from "../producao/actions";

const VAZIO = { clienteNome: "", clienteDocumento: "", clienteCidadeUf: "", numeroNf: "", placaVeiculo: "", quantidadeSacas: "" };

export function FormExpedicao({ lotes, loteInicial }: { lotes: { id: string; rotulo: string; saldo: number }[]; loteInicial?: string }) {
  const router = useRouter();
  const [lote, setLote] = useState(lotes.some((l) => l.id === loteInicial) ? loteInicial! : "");
  const [d, setD] = useState(VAZIO);
  const [msg, setMsg] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const sel = lotes.find((l) => l.id === lote);
  const set = (k: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  return (
    <form
      className="cartao space-y-3 self-start"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        iniciar(async () => {
          const r = await acaoRegistrarExpedicao({ ...d, producaoOrdemId: lote, quantidadeSacas: Number(d.quantidadeSacas) });
          if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro });
          setMsg({ tipo: "sucesso", texto: "Expedição registrada." });
          setD(VAZIO);
          router.refresh();
        });
      }}
    >
      <h2 className="font-semibold">Nova expedição</h2>
      <Campo rotulo="Lote de produto acabado *">
        <select value={lote} onChange={(e) => setLote(e.target.value)} required className="campo">
          <option value="">Selecione…</option>
          {lotes.map((l) => <option key={l.id} value={l.id}>{l.rotulo} — {l.saldo} sc</option>)}
        </select>
      </Campo>
      <Campo rotulo="Cliente *"><input value={d.clienteNome} onChange={set("clienteNome")} required className="campo" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="CPF/CNPJ"><input value={d.clienteDocumento} onChange={set("clienteDocumento")} className="campo" /></Campo>
        <Campo rotulo="Cidade/UF"><input value={d.clienteCidadeUf} onChange={set("clienteCidadeUf")} className="campo" /></Campo>
        <Campo rotulo="NF *"><input value={d.numeroNf} onChange={set("numeroNf")} required className="campo" /></Campo>
        <Campo rotulo="Placa"><input value={d.placaVeiculo} onChange={set("placaVeiculo")} className="campo uppercase" /></Campo>
      </div>
      <Campo rotulo="Quantidade (sacas) *" ajuda={sel ? `Saldo: ${sel.saldo} sacas` : undefined}>
        <input value={d.quantidadeSacas} onChange={set("quantidadeSacas")} inputMode="numeric" required className="campo" />
      </Campo>
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}
      <button className="btn-primario w-full" disabled={pendente}>{pendente ? "Registrando…" : "Registrar saída"}</button>
    </form>
  );
}
