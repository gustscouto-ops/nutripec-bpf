"use client";
import { useActionState } from "react";
import { salvarMateriaPrima } from "../actions";
import { Alerta, Campo } from "@/components/ui";
import { ROTULO_CATEGORIA } from "@/lib/formato";

type Inicial = Record<string, string | number | boolean | null>;

export function FormMateriaPrima({ id, inicial, somenteLeitura }: { id: string | null; inicial: Inicial | null; somenteLeitura: boolean }) {
  const [estado, acao, pendente] = useActionState(salvarMateriaPrima.bind(null, id), null);
  const v = (k: string) => (inicial?.[k] ?? "") as string;
  return (
    <form action={acao} className="space-y-4">
      <fieldset disabled={somenteLeitura} className="cartao grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome comercial *"><input name="nomeComercial" defaultValue={v("nomeComercial")} required className="campo" /></Campo>
        <Campo rotulo="Nome técnico"><input name="nomeTecnico" defaultValue={v("nomeTecnico")} className="campo" /></Campo>
        <Campo rotulo="Código interno"><input name="codigo" defaultValue={v("codigo")} className="campo" /></Campo>
        <Campo rotulo="Prefixo do lote interno *" ajuda="Ex.: BIC → BIC-03102026">
          <input name="prefixoLote" defaultValue={v("prefixoLote")} required maxLength={8} className="campo font-mono uppercase" />
        </Campo>
        <Campo rotulo="Categoria">
          <select name="categoria" defaultValue={v("categoria") || "MACROINGREDIENTE"} className="campo">
            {Object.entries(ROTULO_CATEGORIA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Unidade de medida">
          <select name="unidadeMedida" defaultValue={v("unidadeMedida") || "KG"} className="campo">
            {["KG", "G", "TON", "SC", "L"].map((u) => <option key={u} value={u}>{u.toLowerCase()}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Peso da embalagem (kg)"><input name="pesoEmbalagemKg" inputMode="decimal" defaultValue={v("pesoEmbalagemKg")} className="campo" /></Campo>
        <div />
        <Campo rotulo="Umidade máxima no recebimento (%)" ajuda="Vazio = padrão do RQ 1.2 (14%)"><input name="umidadeMaxPct" inputMode="decimal" defaultValue={v("umidadeMaxPct")} className="campo" /></Campo>
        <Campo rotulo="Temperatura máxima da carga (°C)" ajuda="Vazio = padrão do RQ 1.2 (40 °C)"><input name="temperaturaMaxC" inputMode="decimal" defaultValue={v("temperaturaMaxC")} className="campo" /></Campo>
        <label className="flex items-center gap-2"><input type="checkbox" name="ativo" defaultChecked={inicial ? Boolean(inicial.ativo) : true} className="h-5 w-5" /> Ativa</label>
      </fieldset>
      {estado && !estado.ok && <Alerta>{estado.erro}</Alerta>}
      {!somenteLeitura && (
        <div className="flex gap-2">
          <button className="btn-primario" disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</button>
          <a href="/materias-primas" className="btn-secundario">Voltar</a>
        </div>
      )}
    </form>
  );
}
