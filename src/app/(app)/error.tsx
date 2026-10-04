"use client";
import Link from "next/link";

/** Falha ao abrir uma tela (inclui perfil sem permissão acessando pelo endereço direto). */
export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-bold">Não foi possível abrir esta tela</h1>
      <p className="mt-2 text-slate-600">Seu perfil pode não ter acesso a ela, ou houve uma falha momentânea.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={reset} className="btn-secundario">
          Tentar de novo
        </button>
        <Link href="/" className="btn-primario">
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
