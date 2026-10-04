"use client";
import { useActionState, useState } from "react";
import type { Fornecedor } from "@prisma/client";
import { salvarFornecedor } from "../actions";
import { Alerta, Campo } from "@/components/ui";
import { ROTULO_CATEGORIA } from "@/lib/formato";

export function FormFornecedor({
  id,
  inicial,
  vinculos,
  mps,
  somenteLeitura,
}: {
  id: string | null;
  inicial: Fornecedor | null;
  vinculos: { id: string; homologado: boolean }[];
  mps: { id: string; nomeComercial: string; categoria: string }[];
  somenteLeitura: boolean;
}) {
  const [estado, acao, pendente] = useActionState(salvarFornecedor.bind(null, id), null);
  const [selecionadas, setSelecionadas] = useState(() => new Map(vinculos.map((v) => [v.id, v.homologado])));
  const v = (k: keyof Fornecedor) => (inicial?.[k] as string | null) ?? "";

  return (
    <form action={acao} className="space-y-6">
      <fieldset disabled={somenteLeitura} className="space-y-6">
        <section className="cartao grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Razão social *"><input name="razaoSocial" defaultValue={v("razaoSocial")} required className="campo" /></Campo>
          <Campo rotulo="Nome fantasia"><input name="nomeFantasia" defaultValue={v("nomeFantasia")} className="campo" /></Campo>
          <Campo rotulo="CNPJ *"><input name="cnpj" defaultValue={v("cnpj")} required className="campo" placeholder="00.000.000/0000-00" /></Campo>
          <Campo rotulo="Registro no MAPA (SIF/SIPEAGRO)"><input name="registroMapa" defaultValue={v("registroMapa")} className="campo" /></Campo>
          <Campo rotulo="Contato"><input name="contato" defaultValue={v("contato")} className="campo" /></Campo>
          <Campo rotulo="E-mail"><input name="email" type="email" defaultValue={v("email")} className="campo" /></Campo>
          <Campo rotulo="Telefone"><input name="telefone" defaultValue={v("telefone")} className="campo" /></Campo>
          <Campo rotulo="Cidade/UF"><input name="cidadeUf" defaultValue={v("cidadeUf")} className="campo" /></Campo>
          <Campo rotulo="Status de qualificação">
            <select name="statusQualificacao" defaultValue={inicial?.statusQualificacao ?? "EM_AVALIACAO"} className="campo">
              <option value="EM_AVALIACAO">Em avaliação</option>
              <option value="APROVADO">Aprovado (homologado)</option>
              <option value="REPROVADO">Reprovado</option>
            </select>
          </Campo>
          <label className="flex items-center gap-2 self-end pb-3">
            <input type="checkbox" name="ativo" defaultChecked={inicial?.ativo ?? true} className="h-5 w-5" /> Ativo
          </label>
          <div className="sm:col-span-2">
            <Campo rotulo="Observações da qualificação"><textarea name="observacoes" defaultValue={v("observacoes")} rows={2} className="campo" /></Campo>
          </div>
        </section>

        <section className="cartao">
          <h2 className="font-semibold">Matérias-primas autorizadas</h2>
          <p className="mb-3 text-sm text-slate-600">Marque as que o fornecedor entrega e se cada uma está homologada. O recebimento só aceita pares homologados.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {mps.map((m) => {
              const marcada = selecionadas.has(m.id);
              return (
                <div key={m.id} className={`flex items-center justify-between rounded-lg border p-3 ${marcada ? "border-marca-500 bg-marca-50" : "border-slate-200"}`}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="mp"
                      value={m.id}
                      checked={marcada}
                      onChange={(e) => {
                        const n = new Map(selecionadas);
                        if (e.target.checked) n.set(m.id, true);
                        else n.delete(m.id);
                        setSelecionadas(n);
                      }}
                      className="h-5 w-5"
                    />
                    <span>
                      {m.nomeComercial}
                      <span className="block text-xs text-slate-500">{ROTULO_CATEGORIA[m.categoria]}</span>
                    </span>
                  </label>
                  {marcada && (
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name="homologado"
                        value={m.id}
                        checked={selecionadas.get(m.id)}
                        onChange={(e) => setSelecionadas(new Map(selecionadas).set(m.id, e.target.checked))}
                        className="h-4 w-4"
                      />
                      Homologada
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </fieldset>

      {estado && !estado.ok && <Alerta>{estado.erro}</Alerta>}
      {!somenteLeitura && (
        <div className="flex gap-2">
          <button className="btn-primario" disabled={pendente}>{pendente ? "Salvando…" : "Salvar fornecedor"}</button>
          <a href="/fornecedores" className="btn-secundario">Voltar</a>
        </div>
      )}
    </form>
  );
}
