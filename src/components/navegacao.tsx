"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { linkAtivo, type GrupoMenu, type ItemMenu, type LinkMenu } from "@/lib/menu";

export type { ItemMenu } from "@/lib/menu";

const ICONES: Record<string, string> = {
  painel: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  caminhao: "M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  fabrica: "M3 21V10l6 4V10l6 4V4h6v17z",
  saida: "M5 12h11m0 0-4-4m4 4-4 4M19 5v14",
  rastreio: "M10 18a8 8 0 1 1 5.3-2l5.7 5.7M10 6v4l3 2",
  fornecedor: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  saco: "M7 4h10l2 4v12H5V8zm-2 4h14",
  formula: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  pop: "M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3",
  tarefas: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  alerta: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  livro: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5",
  auditoria: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  usuarios: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  config: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.1 7 7 0 0 1-1.6.9 1.7 1.7 0 0 0-1.1 1.5V23H9v-.3a1.7 1.7 0 0 0-1.1-1.5 7 7 0 0 1-1.6-.9 1.7 1.7 0 0 0-1.8-.1l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.8 7 7 0 0 1 0-1.8 1.7 1.7 0 0 0-.3-1.8L2.3 10l2-3.4.2.1a1.7 1.7 0 0 0 1.8-.1 7 7 0 0 1 1.6-.9A1.7 1.7 0 0 0 9 4.2V4h4v.2a1.7 1.7 0 0 0 1.1 1.5 7 7 0 0 1 1.6.9 1.7 1.7 0 0 0 1.8.1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.8 7 7 0 0 1 0 1.8z",
};

function Icone({ nome }: { nome: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONES[nome] ?? ICONES.painel} />
    </svg>
  );
}

function Contador({ n }: { n?: number }) {
  return n ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{n}</span> : null;
}

export function Navegacao({ itens, empresa, rodape }: { itens: ItemMenu[]; empresa: string; rodape: ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => linkAtivo(href, path, query);
  const grupoAtivo = (g: GrupoMenu) => g.filhos.some((f) => ativo(f.href));
  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(itens.filter((i): i is GrupoMenu => "grupo" in i && grupoAtivo(i)).map((g) => g.grupo)),
  );
  // Ao navegar para uma tela de um POP, abre o grupo dele (sem fechar os que o usuário abriu).
  useEffect(() => {
    const atual = itens.find((i): i is GrupoMenu => "grupo" in i && grupoAtivo(i));
    if (atual) setExpandidos((s) => (s.has(atual.grupo) ? s : new Set(s).add(atual.grupo)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, query]);
  const alternar = (grupo: string) =>
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(grupo)) n.delete(grupo);
      else n.add(grupo);
      return n;
    });

  const link = (item: LinkMenu, filho = false) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setAberto(false)}
      className={`flex items-center gap-3 rounded-lg px-3 font-medium transition ${filho ? "py-1.5 text-[13px] leading-snug" : "py-2.5 text-sm"} ${
        ativo(item.href) ? "bg-white text-marca-900" : "text-white/90 hover:bg-white/10"
      }`}
    >
      {filho ? null : <Icone nome={item.icone} />}
      <span className="flex-1">{item.rotulo}</span>
      <Contador n={item.contador} />
    </Link>
  );

  const lista = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {itens.map((item, i) => {
        if ("secao" in item)
          return (
            <div key={i} className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-marca-100/70 uppercase">
              {item.secao}
            </div>
          );
        if ("grupo" in item) {
          const exp = expandidos.has(item.grupo);
          return (
            <div key={item.grupo}>
              <button
                type="button"
                onClick={() => alternar(item.grupo)}
                aria-expanded={exp}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-white/10 ${
                  grupoAtivo(item) ? "text-white" : "text-white/90"
                }`}
              >
                <Icone nome={item.icone} />
                <span className="flex-1 leading-tight">
                  {item.rotulo}
                  {item.subtitulo && <span className="block text-xs font-normal text-marca-100">{item.subtitulo}</span>}
                </span>
                {!exp && <Contador n={item.contador} />}
                <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 transition ${exp ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              {exp && <div className="mt-0.5 mb-1 ml-5 space-y-0.5 border-l border-white/15 pl-2">{item.filhos.map((f) => link(f, true))}</div>}
            </div>
          );
        }
        return link(item);
      })}
    </nav>
  );

  return (
    <>
      <header className="nao-imprimir sticky top-0 z-30 flex items-center justify-between bg-marca-900 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/icone.svg" alt="" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-bold">NutriPEC BPF</div>
            <div className="text-xs text-marca-100">{empresa}</div>
          </div>
        </div>
        <button onClick={() => setAberto((v) => !v)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d={aberto ? "M6 6l12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </header>
      {aberto && (
        <div className="nao-imprimir fixed inset-0 top-14 z-20 flex flex-col bg-marca-900 lg:hidden">
          {lista}
          {rodape}
        </div>
      )}
      <aside className="nao-imprimir sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-marca-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <img src="/icone.svg" alt="" className="h-10 w-10" />
          <div className="leading-tight">
            <div className="font-bold text-white">NutriPEC BPF</div>
            <div className="text-xs text-marca-100">{empresa}</div>
          </div>
        </div>
        {lista}
        {rodape}
      </aside>
    </>
  );
}
