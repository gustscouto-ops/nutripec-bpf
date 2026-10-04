"use client";
import { useActionState } from "react";
import { entrar } from "./actions";

export function FormLogin() {
  const [estado, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="space-y-4">
      <label className="block">
        <span className="rotulo">E-mail</span>
        <input name="email" type="email" required autoComplete="username" className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" className="campo" />
      </label>
      {estado?.erro && <p className="text-sm font-medium text-red-600">{estado.erro}</p>}
      <button className="btn-primario w-full" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
