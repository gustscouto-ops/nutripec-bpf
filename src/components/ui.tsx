import Link from "next/link";
import type { ReactNode } from "react";

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

const CORES = {
  verde: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  vermelho: "bg-red-100 text-red-800 ring-red-200",
  amarelo: "bg-amber-100 text-amber-900 ring-amber-200",
  azul: "bg-sky-100 text-sky-800 ring-sky-200",
  cinza: "bg-slate-100 text-slate-700 ring-slate-200",
} as const;

export type Cor = keyof typeof CORES;

export function Selo({ cor = "cinza", children }: { cor?: Cor; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${CORES[cor]}`}>{children}</span>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function BotaoLink({ href, children, variante = "primario" }: { href: string; children: ReactNode; variante?: "primario" | "secundario" }) {
  return (
    <Link href={href} className={variante === "primario" ? "btn-primario" : "btn-secundario"}>
      {children}
    </Link>
  );
}

export function Indicador({ rotulo, valor, detalhe, cor = "cinza", href }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; cor?: Cor; href?: string }) {
  const borda = { verde: "border-l-emerald-500", vermelho: "border-l-red-500", amarelo: "border-l-amber-500", azul: "border-l-sky-500", cinza: "border-l-slate-300" }[cor];
  const conteudo = (
    <div className={`cartao h-full border-l-4 ${borda}`}>
      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{rotulo}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-1 text-sm text-slate-600">{detalhe}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export function Campo({ rotulo, erro, children, ajuda }: { rotulo: string; erro?: string; children: ReactNode; ajuda?: string }) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      {children}
      {ajuda && !erro && <span className="mt-1 block text-xs text-slate-500">{ajuda}</span>}
      {erro && <span className="mt-1 block text-sm font-medium text-red-600">{erro}</span>}
    </label>
  );
}

export function Alerta({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "aviso" | "info"; children: ReactNode }) {
  const cls = {
    erro: "border-red-200 bg-red-50 text-red-800",
    sucesso: "border-emerald-200 bg-emerald-50 text-emerald-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tipo];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Dl({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{k}</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
