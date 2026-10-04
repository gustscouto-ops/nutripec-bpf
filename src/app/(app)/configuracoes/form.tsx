"use client";
import { useActionState, useState } from "react";
import { salvarEmpresa } from "./actions";
import { Alerta, Campo } from "@/components/ui";
import { aplicarRegraLote } from "@/lib/lote";

type Dados = Record<"razaoSocial" | "nomeFantasia" | "cnpj" | "registroMapa" | "endereco" | "cidadeUf" | "regraLoteMp" | "regraLoteProd", string>;

export function FormEmpresa({ inicial }: { inicial: Dados }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, null);
  const [mp, setMp] = useState(inicial.regraLoteMp);
  const [prod, setProd] = useState(inicial.regraLoteProd);
  const hoje = new Date();
  return (
    <form action={acao} className="space-y-4">
      <section className="cartao grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Razão social"><input name="razaoSocial" defaultValue={inicial.razaoSocial} className="campo" /></Campo>
        <Campo rotulo="Nome fantasia"><input name="nomeFantasia" defaultValue={inicial.nomeFantasia} className="campo" /></Campo>
        <Campo rotulo="CNPJ" ajuda="Alteração de CNPJ é feita pelo suporte."><input value={inicial.cnpj} disabled className="campo" /></Campo>
        <Campo rotulo="Registro no MAPA"><input name="registroMapa" defaultValue={inicial.registroMapa} className="campo" /></Campo>
        <Campo rotulo="Endereço"><input name="endereco" defaultValue={inicial.endereco} className="campo" /></Campo>
        <Campo rotulo="Cidade/UF"><input name="cidadeUf" defaultValue={inicial.cidadeUf} className="campo" /></Campo>
      </section>
      <section className="cartao space-y-4">
        <div>
          <h2 className="font-semibold">Codificação de lotes</h2>
          <p className="text-sm text-slate-600">
            Tokens: <code>{"{PREFIXO}"}</code> (MP), <code>{"{CODIGO}"}</code> (produto), <code>{"{DD}"}</code> <code>{"{MM}"}</code> <code>{"{AA}"}</code> <code>{"{AAAA}"}</code> <code>{"{DDMMAAAA}"}</code> <code>{"{SEQ}"}</code>
          </p>
        </div>
        <Campo rotulo="Lote interno de matéria-prima" ajuda={`Exemplo hoje: ${aplicarRegraLote(mp, { PREFIXO: "BIC", data: hoje })}`}>
          <input name="regraLoteMp" value={mp} onChange={(e) => setMp(e.target.value)} className="campo font-mono" />
        </Campo>
        <Campo rotulo="Lote de produto acabado" ajuda={`Exemplo hoje: ${aplicarRegraLote(prod, { CODIGO: "C130", data: hoje, seq: 1 })}`}>
          <input name="regraLoteProd" value={prod} onChange={(e) => setProd(e.target.value)} className="campo font-mono" />
        </Campo>
      </section>
      {estado && <Alerta tipo={estado.ok ? "sucesso" : "erro"}>{estado.ok ? estado.mensagem : estado.erro}</Alerta>}
      <button className="btn-primario" disabled={pendente}>{pendente ? "Salvando…" : "Salvar configurações"}</button>
    </form>
  );
}
