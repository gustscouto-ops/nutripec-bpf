"use client";
export function BotaoImprimir({ rotulo = "Imprimir relatório" }: { rotulo?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secundario nao-imprimir">
      {rotulo}
    </button>
  );
}
