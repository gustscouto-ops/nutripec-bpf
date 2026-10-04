import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { ROTULO_TIPO_RECALL } from "@/lib/servicos/recall";
import { Cabecalho, Selo, Vazio } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export const metadata = { title: "Recall e simulados" };

export default async function Recalls() {
  const ctx = await exigirCtx();
  const lista = await prisma.recallRegistro.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { numero: "desc" },
    take: 100,
    select: { id: true, numero: true, tipo: true, alvoCodigo: true, motivo: true, concluidoEm: true, duracaoMin: true, completo: true, userNome: true, resultado: true },
  });
  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo="Recall e simulados"
        subtitulo="POP 08: a partir de um lote suspeito, o sistema cruza entrada, produção e expedição e mede o tempo de rastreio. O simulado assinado registra o RQ 8.1 do semestre."
        acoes={
          pode(ctx.perfil, "recall:registrar") && (
            <Link href={`/recall/novo?inicio=${Date.now()}`} className="btn-primario">
              Iniciar simulado
            </Link>
          )
        }
      />
      {lista.length ? (
        <ul className="space-y-2">
          {lista.map((r) => {
            const t = (r.resultado as { totais: { ordens: number; clientes: number; sacasEstoque: number } }).totais;
            return (
              <li key={r.id}>
                <Link href={`/recall/${r.id}`} className="cartao flex flex-wrap items-center justify-between gap-3 py-3 hover:border-marca-500">
                  <div>
                    <div className="font-semibold">
                      {ROTULO_TIPO_RECALL[r.tipo]} nº {String(r.numero).padStart(4, "0")} · <span className="font-mono">{r.alvoCodigo}</span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {r.motivo} · {r.userNome} · {dataHora(r.concluidoEm)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.ordens} lote(s) de produto · {t.clientes} cliente(s) · {t.sacasEstoque} sacas em estoque · {r.duracaoMin} min
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {r.tipo === "REAL" && <Selo cor="vermelho">Recolhimento</Selo>}
                    <Selo cor={r.completo ? "verde" : "amarelo"}>{r.completo ? "Rastreio completo" : "Com pendências"}</Selo>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhum simulado registrado. A IN 04/2007 pede a verificação periódica do procedimento de recolhimento.</Vazio>
      )}
    </div>
  );
}
