/** CSV com ponto e vírgula e BOM: abre direto no Excel em português. */
export function csv(linhas: (string | number | null | undefined)[][]) {
  const celula = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}
