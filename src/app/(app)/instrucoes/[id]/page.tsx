import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import type { PassoIt } from "@/lib/rq/instrucoes";
import { Cabecalho, Selo } from "@/components/ui";
import { BotaoImprimir } from "@/components/imprimir";

export const metadata = { title: "Instrução de trabalho" };

/** Visão do operador: passos grandes, numerados, com os alertas de segurança em destaque. */
export default async function Instrucao({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirCtx();
  const { id } = await params;
  const it = await prisma.instrucaoTrabalho.findFirst({ where: { id, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }] }, include: { pop: true } });
  if (!it) notFound();
  const propria = it.tenantId ? null : await prisma.instrucaoTrabalho.findFirst({ where: { tenantId: ctx.tenantId, codigo: it.codigo }, select: { id: true } });
  const passos = it.passos as unknown as PassoIt[];
  return (
    <div className="mx-auto max-w-3xl pb-10">
      {propria && (
        <p className="mb-3 text-sm">
          Esta é a versão padrão. <Link href={`/instrucoes/${propria.id}`} className="link">Ver a versão da empresa</Link>
        </p>
      )}
      <Cabecalho
        titulo={`${it.codigo} — ${it.titulo}`}
        subtitulo={
          <>
            POP {String(it.pop.numeroPop).padStart(2, "0")} · {it.pop.titulo} · v{it.versao}
            {it.tenantId ? ` · versão da empresa (${it.atualizadoPor ?? "—"})` : " · padrão do sistema"}
          </>
        }
        acoes={
          <>
            <BotaoImprimir rotulo="Imprimir" />
            {pode(ctx.perfil, "formulario:customizar") && !propria && (
              <Link href={`/instrucoes/${it.id}/editar`} className="btn-secundario">
                Editar
              </Link>
            )}
          </>
        }
      />
      {!it.ativo && (
        <div className="mb-3">
          <Selo cor="amarelo">Instrução desativada</Selo>
        </div>
      )}
      {it.objetivo && <p className="cartao mb-4 text-base">{it.objetivo}</p>}
      <ol className="space-y-3">
        {passos.map((p, i) => (
          <li key={i} className="cartao flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-600 text-lg font-bold text-white">{i + 1}</span>
            <div className="space-y-2">
              <p className="text-lg leading-snug">{p.texto}</p>
              {p.alerta && <p className="rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 font-semibold text-red-800">⚠ {p.alerta}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
