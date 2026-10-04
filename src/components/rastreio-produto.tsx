import Link from "next/link";
import { notFound } from "next/navigation";
import { rastrearParaTras } from "@/lib/servicos/rastreabilidade";
import { num } from "@/lib/db";
import { Dl, Selo } from "@/components/ui";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, ROTULO_TURNO, data, dataHora, kg, numero } from "@/lib/formato";

/** Árvore de rastreabilidade para trás de um lote de produto acabado. */
export async function RastreioProduto({ tenantId, ordemId }: { tenantId: string; ordemId: string }) {
  const r = await rastrearParaTras(tenantId, ordemId);
  if (!r) notFound();
  const { ordem } = r;
  return (
    <div className="space-y-5">
      <section className="cartao">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="font-mono text-3xl font-bold">{ordem.codigoLoteProduzido}</span>
          <Selo cor="azul">{ordem.produto.codigo} · {ordem.produto.nome}</Selo>
        </div>
        <Dl
          itens={[
            ["Data/hora da produção", dataHora(ordem.dataHoraInicio)],
            ["Sequência do dia", `${ordem.sequenciaDia}ª ordem`],
            ["Turno / misturador", `${ROTULO_TURNO[ordem.turno]} · ${ordem.misturador ?? "—"}`],
            ["Operador responsável", ordem.operadorNome],
            ["Bateladas", `${ordem.numeroBateladas} × ${kg(num(ordem.produto.tamanhoBateladaKg))}`],
            ["Fórmula", `versão ${ordem.versaoFormula}${ordem.produto.aprovadoRtNome ? ` · RT ${ordem.produto.aprovadoRtNome}` : ""}`],
            ["Sacas produzidas", numero(ordem.quantidadeSacasProduzidas)],
            ["Expedidas / em estoque", `${numero(r.expedido)} / ${numero(r.saldoSacas)}`],
            ["Validade", data(ordem.dataValidade)],
          ]}
        />
        {ordem.observacoes && <p className="mt-3 text-sm"><b>Observações:</b> {ordem.observacoes}</p>}
        <p className="mt-3 font-mono text-xs break-all text-slate-500">Assinatura SHA-256: {ordem.hashAssinatura}</p>
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Matérias-primas utilizadas (origem)</h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Matéria-prima</th>
                <th>Lote interno</th>
                <th>Fornecedor</th>
                <th>NF / lote forn.</th>
                <th>Recebimento (RQ 1.2)</th>
                <th className="text-right">Dosado</th>
              </tr>
            </thead>
            <tbody>
              {ordem.consumos.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.lote.materiaPrima.nomeComercial}</td>
                  <td className="font-mono"><Link href={`/rastreabilidade/lote-mp/${c.lote.id}`} className="link">{c.lote.codigoLoteInterno}</Link></td>
                  <td>{c.lote.fornecedor.razaoSocial}<div className="text-xs text-slate-500">CNPJ {c.lote.fornecedor.cnpj}</div></td>
                  <td>NF {c.lote.numeroNf}<div className="text-xs text-slate-500">{c.lote.loteFornecedor ?? "—"}</div></td>
                  <td>
                    {c.lote.rqExecucao ? (
                      <Link href={`/recebimento/${c.lote.rqExecucao.id}`} className="link">nº {String(c.lote.rqExecucao.numero).padStart(4, "0")}</Link>
                    ) : "—"}
                    <div className="mt-1"><Selo cor={COR_STATUS_LOTE[c.lote.status]}>{ROTULO_STATUS_LOTE[c.lote.status]}</Selo></div>
                  </td>
                  <td className="text-right tabular-nums">{kg(num(c.quantidadeUtilizadaKg))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao">
        <h2 className="mb-3 font-semibold">Destino (expedições)</h2>
        {ordem.expedicoes.length ? (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Cliente</th><th>NF</th><th>Placa</th><th className="text-right">Sacas</th></tr></thead>
            <tbody>
              {ordem.expedicoes.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.dataHora)}</td>
                  <td>{e.clienteNome}<div className="text-xs text-slate-500">{e.clienteDocumento} · {e.clienteCidadeUf}</div></td>
                  <td>{e.numeroNf}</td>
                  <td>{e.placaVeiculo ?? "—"}</td>
                  <td className="text-right tabular-nums">{e.quantidadeSacas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-600">Nenhuma saída registrada. Todo o lote está em estoque.</p>
        )}
      </section>
    </div>
  );
}
