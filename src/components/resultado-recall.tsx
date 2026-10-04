import Link from "next/link";
import type { ResultadoRecall } from "@/lib/servicos/recall";
import { Alerta, Indicador, Selo, Vazio } from "@/components/ui";
import { COR_STATUS_LOTE, ROTULO_STATUS_LOTE, data, kg } from "@/lib/formato";

/** Árvore entrada → produção → saída de um recall (prévia ao vivo ou fotografia assinada). */
export function ResultadoRecallView({ r }: { r: ResultadoRecall }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Lotes de produto afetados" valor={r.totais.ordens} detalhe={`${r.totais.sacasProduzidas} sacas produzidas`} cor="amarelo" />
        <Indicador rotulo="Sacas em estoque" valor={r.totais.sacasEstoque} detalhe="bloquear e segregar" cor={r.totais.sacasEstoque ? "vermelho" : "verde"} />
        <Indicador rotulo="Clientes a notificar" valor={r.totais.clientes} detalhe={`${r.totais.sacasExpedidas} sacas expedidas`} cor={r.totais.clientes ? "vermelho" : "verde"} />
        <Indicador rotulo="Lotes de MP de origem" valor={r.totais.lotesMp} detalhe={`${kg(r.totais.kgSuspeitoConsumido)} do insumo suspeito dosados`} cor="azul" />
      </div>

      {r.pendencias.length ? (
        <Alerta>
          <b>Rastreio com pendências.</b> Corrija antes de um recall real:
          <ul className="mt-1 list-disc pl-5">
            {r.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alerta>
      ) : (
        <Alerta tipo="sucesso">Rastreio completo: toda a cadeia entrada → produção → saída está apontada.</Alerta>
      )}

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">1. Entrada: lotes de matéria-prima</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Matéria-prima / fornecedor</th>
              <th>NF</th>
              <th>Recebimento</th>
              <th className="text-right">Recebido</th>
              <th className="text-right">Consumido</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {r.lotesMp.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/rastreabilidade/lote-mp/${l.id}`} className="link font-mono">
                    {l.codigo}
                  </Link>
                  <div>
                    <Selo cor={COR_STATUS_LOTE[l.status as keyof typeof COR_STATUS_LOTE]}>{ROTULO_STATUS_LOTE[l.status as keyof typeof ROTULO_STATUS_LOTE]}</Selo>
                  </div>
                </td>
                <td>
                  {l.materiaPrima}
                  <div className="text-xs text-slate-500">
                    {l.fornecedor} · {l.cnpj}
                  </div>
                </td>
                <td>
                  {l.nf}
                  {l.loteFornecedor && <div className="text-xs text-slate-500">lote {l.loteFornecedor}</div>}
                </td>
                <td>
                  {data(l.recebidoEm)}
                  <div className="text-xs">
                    {l.rq ? (
                      <Link href={`/recebimento/${l.rq.id}`} className="link">
                        RQ 1.2 nº {String(l.rq.numero).padStart(4, "0")}
                      </Link>
                    ) : (
                      <span className="font-semibold text-red-600">sem RQ 1.2</span>
                    )}
                  </div>
                </td>
                <td className="text-right tabular-nums">{kg(l.recebidoKg)}</td>
                <td className="text-right tabular-nums">{kg(l.consumidoKg)}</td>
                <td className="text-right tabular-nums">{kg(l.saldoKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">2. Produção: lotes de produto afetados</h2>
        {r.ordens.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Produto</th>
                <th>Fabricação</th>
                <th>Lotes de MP usados</th>
                <th className="text-right">Insumo suspeito</th>
                <th className="text-right">Produzidas</th>
                <th className="text-right">Expedidas</th>
                <th className="text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {r.ordens.map((o) => (
                <tr key={o.id} className={o.alvo ? "bg-amber-50" : ""}>
                  <td>
                    <Link href={`/rastreabilidade/lote-produto/${o.id}`} className="link font-mono">
                      {o.lote}
                    </Link>
                    {o.alvo && <div className="text-xs font-semibold text-amber-800">lote reclamado</div>}
                  </td>
                  <td>{o.produto}</td>
                  <td>
                    {data(o.fabricadoEm)}
                    <div className="text-xs text-slate-500">val. {data(o.validade)}</div>
                  </td>
                  <td className="font-mono text-xs">{o.lotesMp.join(", ")}</td>
                  <td className="text-right tabular-nums">{kg(o.kgSuspeito)}</td>
                  <td className="text-right tabular-nums">{o.sacas}</td>
                  <td className="text-right tabular-nums">{o.expedidas}</td>
                  <td className={`text-right font-semibold tabular-nums ${o.estoque ? "text-red-700" : ""}`}>{o.estoque}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>O lote ainda não foi usado em nenhuma produção.</Vazio>
        )}
      </section>

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">3. Saída: clientes a notificar</h2>
        {r.clientes.length ? (
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Notas fiscais</th>
                <th className="text-right">Sacas</th>
              </tr>
            </thead>
            <tbody>
              {r.clientes.map((c) => (
                <tr key={`${c.nome}|${c.documento}`}>
                  <td>
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-slate-500">{[c.documento, c.cidadeUf].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="text-sm">
                    {c.envios.map((e, i) => (
                      <div key={i}>
                        NF {e.nf} · <span className="font-mono">{e.lote}</span> · {e.sacas} sc · {data(e.data)}
                      </div>
                    ))}
                  </td>
                  <td className="text-right font-semibold tabular-nums">{c.sacas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio>Nenhuma expedição dos lotes afetados.</Vazio>
        )}
      </section>
    </div>
  );
}
