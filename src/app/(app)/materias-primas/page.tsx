import Link from "next/link";
import { exigirCtx } from "@/lib/auth";
import { prisma, num } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { saldosLotes } from "@/lib/servicos/recebimento";
import { Cabecalho, Vazio, BotaoLink, Selo } from "@/components/ui";
import { ROTULO_CATEGORIA, kg } from "@/lib/formato";

export const metadata = { title: "Matérias-primas" };

export default async function MateriasPrimas() {
  const ctx = await exigirCtx();
  const [mps, lotes, consumos] = await Promise.all([
    prisma.materiaPrima.findMany({
      where: { tenantId: ctx.tenantId },
      include: { fornecedores: { where: { homologado: true, fornecedor: { statusQualificacao: "APROVADO" } } } },
      orderBy: { nomeComercial: "asc" },
    }),
    prisma.loteMateriaPrima.findMany({ where: { tenantId: ctx.tenantId, status: "LIBERADO" }, select: { id: true, materiaPrimaId: true, quantidadeKg: true } }),
    saldosLotes(ctx.tenantId),
  ]);
  const estoque = new Map<string, number>();
  for (const l of lotes) estoque.set(l.materiaPrimaId, (estoque.get(l.materiaPrimaId) ?? 0) + num(l.quantidadeKg) - (consumos.get(l.id) ?? 0));

  return (
    <div className="mx-auto max-w-7xl">
      <Cabecalho
        titulo="Matérias-primas e insumos"
        subtitulo="O prefixo define o código do lote interno gerado no recebimento (ex.: BIC-03102026)."
        acoes={pode(ctx.perfil, "cadastros:editar") && <BotaoLink href="/materias-primas/novo">+ Nova matéria-prima</BotaoLink>}
      />
      <div className="cartao overflow-x-auto p-0 sm:p-0">
        {mps.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome comercial</th>
                <th>Categoria</th>
                <th>Prefixo lote</th>
                <th>Unid.</th>
                <th>Limites recebimento</th>
                <th>Fornec. homologados</th>
                <th className="text-right">Estoque liberado</th>
              </tr>
            </thead>
            <tbody>
              {mps.map((m) => (
                <tr key={m.id} className={m.ativo ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/materias-primas/${m.id}`} className="link">{m.nomeComercial}</Link>
                    <div className="text-xs text-slate-500">{m.nomeTecnico}</div>
                  </td>
                  <td>{ROTULO_CATEGORIA[m.categoria]}</td>
                  <td className="font-mono">{m.prefixoLote}</td>
                  <td>{m.unidadeMedida.toLowerCase()}</td>
                  <td className="text-xs text-slate-600">
                    {m.umidadeMaxPct !== null && <div>Umidade ≤ {num(m.umidadeMaxPct)}%</div>}
                    {m.temperaturaMaxC !== null && <div>Temp. ≤ {num(m.temperaturaMaxC)} °C</div>}
                  </td>
                  <td>{m.fornecedores.length ? m.fornecedores.length : <Selo cor="vermelho">nenhum</Selo>}</td>
                  <td className="text-right tabular-nums">{kg(estoque.get(m.id) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhuma matéria-prima cadastrada.</Vazio>
        )}
      </div>
    </div>
  );
}
