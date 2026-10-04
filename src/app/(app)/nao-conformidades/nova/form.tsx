"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GravidadeNc } from "@prisma/client";
import { Alerta, Campo } from "@/components/ui";
import { acaoAbrirNc } from "../actions";

export function FormNovaNc({ pops, fornecedores }: { pops: { numeroPop: number; titulo: string }[]; fornecedores: { id: string; razaoSocial: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState({ origem: "RECLAMACAO_CLIENTE", titulo: "", descricao: "", acaoImediata: "", gravidade: "MEDIA", popNumero: "", fornecedorId: "", loteReferencia: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  return (
    <form
      className="cartao space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await acaoAbrirNc({
            origem: d.origem as "RECLAMACAO_CLIENTE",
            titulo: d.titulo,
            descricao: d.descricao,
            acaoImediata: d.acaoImediata,
            gravidade: d.gravidade as GravidadeNc,
            popNumero: d.popNumero ? Number(d.popNumero) : null,
            fornecedorId: d.fornecedorId || null,
            loteReferencia: d.loteReferencia || null,
          });
          if (!r.ok) return setErro(r.erro);
          router.push(`/nao-conformidades/${r.dados}`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Origem">
          <select value={d.origem} onChange={set("origem")} className="campo">
            <option value="RECLAMACAO_CLIENTE">Reclamação de cliente</option>
            <option value="AUDITORIA_INTERNA">Auditoria interna</option>
            <option value="FISCALIZACAO">Fiscalização MAPA</option>
            <option value="OUTRA">Outra</option>
          </select>
        </Campo>
        <Campo rotulo="Gravidade">
          <select value={d.gravidade} onChange={set("gravidade")} className="campo">
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
          </select>
        </Campo>
        <Campo rotulo="POP relacionado">
          <select value={d.popNumero} onChange={set("popNumero")} className="campo">
            <option value="">—</option>
            {pops.map((p) => <option key={p.numeroPop} value={p.numeroPop}>POP {String(p.numeroPop).padStart(2, "0")} — {p.titulo}</option>)}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Título *"><input value={d.titulo} onChange={set("titulo")} className="campo" placeholder="Ex.: Cliente relata sacos com ração empedrada" /></Campo>
      <Campo rotulo="Descrição do ocorrido *"><textarea value={d.descricao} onChange={set("descricao")} rows={3} className="campo" /></Campo>
      <Campo rotulo="Ação imediata tomada *"><textarea value={d.acaoImediata} onChange={set("acaoImediata")} rows={2} className="campo" /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Fornecedor envolvido">
          <select value={d.fornecedorId} onChange={set("fornecedorId")} className="campo">
            <option value="">—</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Lote envolvido"><input value={d.loteReferencia} onChange={set("loteReferencia")} className="campo font-mono" placeholder="Ex.: C130-031026-01" /></Campo>
      </div>
      {erro && <Alerta>{erro}</Alerta>}
      <button className="btn-primario" disabled={pendente}>{pendente ? "Registrando…" : "Registrar não conformidade"}</button>
    </form>
  );
}
