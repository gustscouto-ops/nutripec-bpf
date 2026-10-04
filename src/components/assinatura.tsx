"use client";
import { useState } from "react";

/**
 * Caixa de assinatura eletrônica: o usuário confirma a própria senha para fechar o registro.
 * A senha é validada no servidor (bcrypt) e o conteúdo assinado recebe um hash SHA-256.
 */
export function Assinatura({
  titulo = "Assinatura eletrônica",
  declaracao,
  rotuloBotao = "Assinar e finalizar",
  pendente,
  onAssinar,
  perigo,
}: {
  titulo?: string;
  declaracao: string;
  rotuloBotao?: string;
  pendente?: boolean;
  onAssinar: (senha: string) => void;
  perigo?: boolean;
}) {
  const [senha, setSenha] = useState("");
  return (
    <div className="rounded-xl border-2 border-marca-500 bg-marca-50 p-4">
      <div className="flex items-center gap-2 font-semibold text-marca-900">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4" />
        </svg>
        {titulo}
      </div>
      <p className="mt-1 text-sm text-slate-700">{declaracao}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Sua senha"
          autoComplete="current-password"
          className="campo sm:max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && senha) {
              e.preventDefault();
              onAssinar(senha);
            }
          }}
        />
        <button type="button" disabled={!senha || pendente} onClick={() => onAssinar(senha)} className={perigo ? "btn-perigo" : "btn-primario"}>
          {pendente ? "Assinando…" : rotuloBotao}
        </button>
      </div>
    </div>
  );
}
