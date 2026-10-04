import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Cabecalho, Selo, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Trilha de auditoria" };
const POR_PAGINA = 50;

function Diff({ antes, depois }: { antes: unknown; depois: unknown }) {
  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (depois ?? {}) as Record<string, unknown>;
  if (Array.isArray(antes) || Array.isArray(depois) || !antes || !depois) {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {antes != null && <pre className="overflow-x-auto rounded bg-red-50 p-2 text-xs">{JSON.stringify(antes, null, 2)}</pre>}
        {depois != null && <pre className="overflow-x-auto rounded bg-emerald-50 p-2 text-xs">{JSON.stringify(depois, null, 2)}</pre>}
      </div>
    );
  }
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]));
  if (!chaves.length) return <p className="text-xs text-slate-500">Sem alteração de valores.</p>;
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2">Campo</th><th className="pr-2">Valor anterior</th><th>Valor novo</th></tr></thead>
      <tbody>
        {chaves.map((k) => (
          <tr key={k} className="border-t border-slate-100 align-top">
            <td className="py-1 pr-2 font-mono">{k}</td>
            <td className="pr-2 break-all text-red-700 line-through decoration-red-300">{JSON.stringify(a[k])}</td>
            <td className="break-all text-emerald-800">{JSON.stringify(d[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ p?: string; tabela?: string; registro?: string }> }) {
  const ctx = await exigirCtx("auditoria:ver");
  const { p = "1", tabela, registro } = await searchParams;
  const pagina = Math.max(1, Number(p) || 1);
  const where = { tenantId: ctx.tenantId, ...(tabela ? { tabelaAfetada: tabela } : {}), ...(registro ? { registroId: registro } : {}) };
  const [logs, total, tabelas] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["tabelaAfetada"], where: { tenantId: ctx.tenantId }, _count: true }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (np: number) => `/auditoria?p=${np}${tabela ? `&tabela=${tabela}` : ""}${registro ? `&registro=${registro}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho
        titulo="Trilha de auditoria"
        subtitulo="Registro imutável de quem alterou o quê, quando e qual era o valor anterior. O banco de dados bloqueia edição e exclusão destes registros."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/auditoria" className={`rounded-full px-3 py-1.5 text-sm ${!tabela ? "bg-marca-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>Tudo</Link>
        {tabelas.map((t) => (
          <Link key={t.tabelaAfetada} href={`/auditoria?tabela=${t.tabelaAfetada}`} className={`rounded-full px-3 py-1.5 text-sm ${tabela === t.tabelaAfetada ? "bg-marca-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {t.tabelaAfetada} ({t._count})
          </Link>
        ))}
      </div>
      {logs.length ? (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={String(l.id)} className="cartao py-3">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-mono text-xs text-slate-400">#{String(l.id)}</span>
                  <span className="whitespace-nowrap text-slate-600">{dataHora(l.createdAt)}</span>
                  <Selo cor={l.acao.startsWith("DELETE") || l.acao.includes("RECUSADA") || l.acao.includes("REPROVADO") ? "vermelho" : l.acao === "CREATE" ? "verde" : l.acao.startsWith("ASSINATURA") || l.acao.startsWith("APROVACAO") || l.acao.startsWith("DECISAO") ? "azul" : "cinza"}>{l.acao}</Selo>
                  <span className="font-medium">{l.tabelaAfetada}</span>
                  <Link href={`/auditoria?registro=${l.registroId}`} className="font-mono text-xs text-slate-500 hover:underline">{l.registroId.slice(0, 10)}…</Link>
                  <span className="ml-auto text-slate-700">{l.userNome ?? "sistema"}{l.ip ? ` · ${l.ip}` : ""}</span>
                </summary>
                <div className="mt-3"><Diff antes={l.dadosAnteriores} depois={l.dadosNovos} /></div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Nenhum registro.</Vazio>
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-600">{total} registros · página {pagina} de {paginas}</span>
        <div className="flex gap-2">
          {pagina > 1 && <Link href={link(pagina - 1)} className="btn-secundario">Anterior</Link>}
          {pagina < paginas && <Link href={link(pagina + 1)} className="btn-secundario">Próxima</Link>}
        </div>
      </div>
    </div>
  );
}
