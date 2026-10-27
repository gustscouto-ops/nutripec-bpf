"use client";
import { useActionState } from "react";
import { trocarSenha } from "./actions";
import { Alerta, Campo } from "@/components/ui";

export function FormSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, null);
  return (
    <form action={acao} className="cartao space-y-3">
      <Campo rotulo="Senha atual"><input name="atual" type="password" required autoComplete="current-password" className="campo" /></Campo>
      <Campo rotulo="Nova senha" ajuda="Mínimo 8 caracteres"><input name="nova" type="password" required minLength={8} autoComplete="new-password" className="campo" /></Campo>
      <Campo rotulo="Confirme a nova senha"><input name="confirmacao" type="password" required minLength={8} autoComplete="new-password" className="campo" /></Campo>
      {estado && <Alerta tipo={estado.ok ? "sucesso" : "erro"}>{estado.ok ? estado.mensagem : estado.erro}</Alerta>}
      <button className="btn-primario w-full" disabled={pendente}>{pendente ? "Salvando…" : "Trocar senha"}</button>
    </form>
  );
}
