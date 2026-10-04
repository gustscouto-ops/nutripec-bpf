import { blocosRotulo, linhasIdentificacao, linhasLote, TAMANHOS, type DadosRotulo, type Tamanho } from "@/lib/rotulo";

/** Espelho do rótulo em tamanho real (mm), com o mesmo conteúdo do arquivo ZPL. */
export function PreviaRotulo({ dados, tamanho }: { dados: DadosRotulo; tamanho: Tamanho }) {
  const t = TAMANHOS[tamanho];
  const lote = linhasLote(dados);
  return (
    <div
      className="etiqueta mx-auto overflow-hidden border border-slate-400 bg-white p-[3mm] text-black shadow-sm"
      style={{ width: `${t.larguraMm}mm`, minHeight: `${t.alturaMm}mm`, fontFamily: "Arial, Helvetica, sans-serif", fontSize: "7.5pt", lineHeight: 1.25 }}
    >
      <div className="text-center text-[13pt] leading-tight font-bold">{dados.produto.nome.toUpperCase()}</div>
      <div className="text-center text-[8pt]">{[dados.produto.categoria, dados.produto.especieDestino].filter(Boolean).join(" · ")}</div>
      <hr className="my-1 border-black" />
      {blocosRotulo(dados).map((b, i) => (
        <div key={i} className="mb-1">
          {b.titulo && <div className="font-bold">{b.titulo}</div>}
          {b.linhas.map((l, j) => (
            <div key={j}>{l}</div>
          ))}
        </div>
      ))}
      <hr className="my-1 border-black" />
      <div className="text-[6.5pt]">
        {linhasIdentificacao(dados).map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      <div className="mt-1 text-[12pt] font-bold">PESO LÍQUIDO: {dados.produto.pesoSacariaKg.toLocaleString("pt-BR")} kg</div>
      <div className="font-bold">
        {lote.lote} &nbsp; {lote.fabricacao}
      </div>
      <div className="font-bold">{lote.validade}</div>
      {dados.lote && (
        <div className="mt-1 inline-block border border-black px-2 py-1 font-mono text-[9pt] tracking-widest" title="Código de barras Code 128 na etiqueta ZPL">
          ||||| {dados.lote.codigo} |||||
        </div>
      )}
    </div>
  );
}
