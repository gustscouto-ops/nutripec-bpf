"use client";
import { useActionState, useState } from "react";
import { Alerta, Campo } from "@/components/ui";
import type { DadosManual } from "@/lib/manual-bpf";
import { ESTADOS } from "@/lib/manual-bpf";
import { salvarManual } from "./actions";

type Props = { inicial: DadosManual; hoje: string; podeEditar: boolean };

export function FormManual({ inicial, hoje, podeEditar }: Props) {
  const [estado, acao, pendente] = useActionState(salvarManual, null);
  const [data, setData] = useState(inicial.dataEmissao);
  const [revisao, setRevisao] = useState(inicial.revisao);
  const erros = (estado && !estado.ok ? estado.campos : undefined) ?? {};
  const campo = (nome: keyof DadosManual, rotulo: string, ajuda?: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erros[nome]}>
      <input name={nome} defaultValue={inicial[nome]} disabled={!podeEditar} className="campo" {...extra} />
    </Campo>
  );
  function novaEmissaoAnual() {
    setData(hoje);
    setRevisao((r) => String(Number(r || 0) + 1).padStart(Math.max(2, r.length), "0"));
  }

  return (
    <form action={acao} className="space-y-4">
      <fieldset disabled={!podeEditar} className="space-y-4">
        <section className="cartao space-y-4">
          <div>
            <h2 className="font-semibold">Emissão</h2>
            <p className="text-sm text-slate-600">A data entra no cabeçalho de todas as páginas, nas assinaturas do rodapé dos registros e no &ldquo;ANO&rdquo; das capas. Troque a cada ano e gere o PDF de novo.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Data de emissão" erro={erros.dataEmissao}>
              <input type="date" name="dataEmissao" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Revisão" ajuda={`Aparece como “Revisão: ${revisao || "02"}” nos cabeçalhos.`} erro={erros.revisao}>
              <input name="revisao" value={revisao} onChange={(e) => setRevisao(e.target.value)} inputMode="numeric" className="campo" />
            </Campo>
            {podeEditar && (
              <div className="flex items-end">
                <button type="button" onClick={novaEmissaoAnual} className="btn-secundario w-full">
                  Nova emissão anual (hoje, revisão +1)
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="cartao space-y-4">
          <div>
            <h2 className="font-semibold">Indústria</h2>
            <p className="text-sm text-slate-600">
              Razão social e CNPJ vêm de Configurações: <strong>{inicial.razaoSocial}</strong> · {inicial.cnpj}. Os demais dados aparecem na capa, no cabeçalho e no rodapé dos registros.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("cabecalhoLinha1", "Nome no quadro do cabeçalho (linha 1)", "No modelo: AGROLESTE")}
            {campo("cabecalhoLinha2", "Linha 2 do quadro", "No modelo: Nutrição Animal")}
            {campo("inscricaoEstadual", "Inscrição estadual")}
            {campo("atividade", "Atividade", "Linha “Atividade:” da capa")}
            {campo("logradouro", "Endereço", "Ex.: ROD LMG 766 KM 04, S/N")}
            {campo("bairro", "Bairro")}
            {campo("cidade", "Cidade")}
            <Campo rotulo="UF" erro={erros.uf}>
              <select name="uf" defaultValue={inicial.uf} className="campo">
                <option value="">—</option>
                {Object.entries(ESTADOS).map(([sigla, nome]) => (
                  <option key={sigla} value={sigla}>
                    {sigla} · {nome}
                  </option>
                ))}
              </select>
            </Campo>
            {campo("cep", "CEP")}
            {campo("telefone", "Telefone/celular")}
            {campo("email", "E-mail", undefined, { type: "email" })}
          </div>
        </section>

        <section className="cartao space-y-4">
          <div>
            <h2 className="font-semibold">Responsáveis (rodapé)</h2>
            <p className="text-sm text-slate-600">Substituem os nomes do modelo em “Elaborado/Revisado por”, “Aprovado por”, “Monitorado por” e na capa.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("rtNome", "Responsável Técnico", "Elaborado e revisado por")}
            {campo("rtRegistro", "Registro do RT", "Ex.: CRMV/MG – 1627/Z")}
            {campo("responsavelLegal", "Responsável Legal", "Aprovado por")}
            {campo("responsavelFabrica", "Responsável pela Fábrica", "Se vazio, usa o Responsável Legal")}
            {campo("controleQualidade", "Controle de Qualidade", "Monitorado por (POP 07). Se vazio, usa o RT")}
          </div>
        </section>
      </fieldset>
      {estado && <Alerta tipo={estado.ok ? "sucesso" : "erro"}>{estado.ok ? estado.mensagem : estado.erro}</Alerta>}
      {podeEditar && (
        <button className="btn-primario" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar dados do manual"}
        </button>
      )}
    </form>
  );
}
