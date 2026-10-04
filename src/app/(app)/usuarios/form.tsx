"use client";
import { useActionState } from "react";
import { adicionarUsuario } from "./actions";
import { Alerta, Campo } from "@/components/ui";

export function FormUsuario() {
  const [estado, acao, pendente] = useActionState(adicionarUsuario, null);
  return (
    <form action={acao} className="cartao space-y-3 self-start">
      <h2 className="font-semibold">Adicionar usuário</h2>
      <p className="text-xs text-slate-500">Se o e-mail já existir (ex.: consultor de outra fábrica), apenas o acesso a esta empresa é criado.</p>
      <Campo rotulo="E-mail *"><input name="email" type="email" required className="campo" /></Campo>
      <Campo rotulo="Nome"><input name="nome" className="campo" /></Campo>
      <Campo rotulo="Perfil *">
        <select name="perfil" className="campo" defaultValue="OPERADOR">
          <option value="OPERADOR">Operador</option>
          <option value="RT">Responsável Técnico</option>
          <option value="CEO">CEO / Proprietário</option>
          <option value="CONSULTOR">Consultor de BPF</option>
          <option value="AUDITOR">Auditor Fiscal (leitura)</option>
        </select>
      </Campo>
      <Campo rotulo="Cargo"><input name="cargo" className="campo" /></Campo>
      <Campo rotulo="Registro profissional" ajuda="CRMV, CRZ ou CREA (para RT)"><input name="registroProfissional" className="campo" /></Campo>
      <Campo rotulo="Senha inicial" ajuda="Mínimo 8 caracteres (só para usuário novo)"><input name="senha" type="password" autoComplete="new-password" className="campo" /></Campo>
      {estado && <Alerta tipo={estado.ok ? "sucesso" : "erro"}>{estado.ok ? estado.mensagem : estado.erro}</Alerta>}
      <button className="btn-primario w-full" disabled={pendente}>{pendente ? "Salvando…" : "Adicionar"}</button>
    </form>
  );
}
