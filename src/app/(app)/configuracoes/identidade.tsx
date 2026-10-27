"use client";
import { useActionState, useState } from "react";
import { acaoSalvarIdentidade } from "./actions";
import { Alerta, Campo } from "@/components/ui";
import type { DadosIdentidade } from "@/lib/servicos/identidade";

/** Dados do cabeçalho (logo e nome) e do rodapé (RT, controle de qualidade, proprietário) dos RQs impressos. */
export function FormIdentidade({ inicial, temLogo, salvo }: { inicial: DadosIdentidade; temLogo: boolean; salvo: boolean }) {
  const [estado, acao, pendente] = useActionState(acaoSalvarIdentidade, null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [remover, setRemover] = useState(false);
  const erros = estado && !estado.ok ? (estado.campos ?? {}) : {};
  return (
    <form action={acao} className="cartao mt-6 space-y-4">
      <div>
        <h2 className="font-semibold">Cabeçalho e rodapé dos RQs</h2>
        <p className="text-sm text-slate-600">
          Saem em todos os formulários impressos (preenchidos e em branco): logo e nome no cabeçalho, junto do código, revisão e data do RQ; no rodapé, quem elabora e verifica, monitora e
          aprova.
          {!salvo && " Os campos vieram preenchidos com sugestões do cadastro e do Manual de BPF; confira e salve."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          {previa ? (
            <img src={previa} alt="Novo logo" className="max-h-full max-w-full object-contain" />
          ) : temLogo && !remover ? (
            <img src="/api/identidade/logo" alt="Logo atual" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">sem logo</span>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPrevia(f ? URL.createObjectURL(f) : null);
              setRemover(false);
            }}
          />
          <div className="text-xs text-slate-500">PNG ou JPG, até 2 MB.</div>
          {temLogo && !previa && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="removerLogo" value="1" checked={remover} onChange={(e) => setRemover(e.target.checked)} />
              Remover o logo atual
            </label>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome no cabeçalho" erro={erros.nomeCabecalho}>
          <input name="nomeCabecalho" defaultValue={inicial.nomeCabecalho} className="campo" />
        </Campo>
        <Campo rotulo="Responsável Técnico (elabora e verifica)" erro={erros.rtNome}>
          <input name="rtNome" defaultValue={inicial.rtNome} className="campo" />
        </Campo>
        <Campo rotulo="Registro do RT (ex.: CRMV/MG 1627/Z)">
          <input name="rtRegistro" defaultValue={inicial.rtRegistro} className="campo" />
        </Campo>
        <Campo rotulo="Controle de qualidade (monitora)">
          <input name="controleQualidade" defaultValue={inicial.controleQualidade} className="campo" />
        </Campo>
        <Campo rotulo="Proprietário (aprova)">
          <input name="proprietario" defaultValue={inicial.proprietario} className="campo" />
        </Campo>
      </div>
      {estado && <Alerta tipo={estado.ok ? "sucesso" : "erro"}>{estado.ok ? estado.mensagem : estado.erro}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar cabeçalho e rodapé"}
        </button>
        <a href="/api/rq/formularios?pop=6" target="_blank" className="btn-secundario">
          Ver exemplo (RQs do POP 06)
        </a>
      </div>
    </form>
  );
}
