"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GravidadeNc, StatusNc } from "@prisma/client";
import { Assinatura } from "@/components/assinatura";
import { Alerta, Campo } from "@/components/ui";
import { acaoCancelar, acaoExecutada, acaoPlano, acaoVerificar } from "../actions";

type Plano = { causaRaiz: string; acaoPreventiva: string; responsavelAcao: string; prazo: string; gravidade: GravidadeNc };

export function FluxoNc({ id, status, plano, pode, nomeUsuario }: { id: string; status: StatusNc; plano: Plano; pode: { tratar: boolean; executar: boolean; encerrar: boolean }; nomeUsuario: string }) {
  const router = useRouter();
  const [p, setP] = useState(plano);
  const [execucao, setExecucao] = useState("");
  const [verificacao, setVerificacao] = useState("");
  const [eficaz, setEficaz] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string; mensagem?: string }>) =>
    iniciar(async () => {
      setMsg(null);
      const r = await fn();
      if (!r.ok) return setMsg({ tipo: "erro", texto: r.erro! });
      setMsg({ tipo: "sucesso", texto: r.mensagem ?? "Salvo." });
      router.refresh();
    });

  if (status === "ENCERRADA" || status === "CANCELADA") return null;
  const set = (k: keyof Plano) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });

  return (
    <div className="space-y-4">
      {msg && <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>}

      {(status === "ABERTA" || status === "EM_TRATAMENTO") && pode.tratar && (
        <section className="cartao space-y-3">
          <h2 className="font-semibold">{status === "ABERTA" ? "Definir plano de ação" : "Revisar plano de ação"}</h2>
          <Campo rotulo="Causa raiz (por que aconteceu?) *" ajuda="Dica: pergunte 'por quê?' até chegar à causa que, eliminada, impede a repetição.">
            <textarea value={p.causaRaiz} onChange={set("causaRaiz")} rows={2} className="campo" />
          </Campo>
          <Campo rotulo="Ação preventiva *"><textarea value={p.acaoPreventiva} onChange={set("acaoPreventiva")} rows={2} className="campo" /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Responsável *"><input value={p.responsavelAcao} onChange={set("responsavelAcao")} className="campo" /></Campo>
            <Campo rotulo="Prazo *"><input type="date" value={p.prazo} onChange={set("prazo")} className="campo" /></Campo>
            <Campo rotulo="Gravidade">
              <select value={p.gravidade} onChange={set("gravidade")} className="campo">
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
              </select>
            </Campo>
          </div>
          <button className="btn-primario" disabled={pendente} onClick={() => rodar(() => acaoPlano(id, p))}>Salvar plano</button>
        </section>
      )}

      {status === "EM_TRATAMENTO" && pode.executar && (
        <section className="cartao space-y-3">
          <h2 className="font-semibold">Registrar execução da ação preventiva</h2>
          <Campo rotulo="O que foi feito *"><textarea value={execucao} onChange={(e) => setExecucao(e.target.value)} rows={2} className="campo" /></Campo>
          <button className="btn-primario" disabled={pendente} onClick={() => rodar(() => acaoExecutada(id, execucao))}>Registrar execução</button>
        </section>
      )}

      {status === "AGUARDANDO_VERIFICACAO" &&
        (pode.encerrar ? (
          <section className="cartao space-y-3">
            <h2 className="font-semibold">Verificação de eficácia</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEficaz(true)} className={`btn border-2 ${eficaz ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white"}`}>Ação eficaz</button>
              <button type="button" onClick={() => setEficaz(false)} className={`btn border-2 ${!eficaz ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white"}`}>Não foi eficaz</button>
            </div>
            <Campo rotulo="Evidência da verificação *" ajuda="Ex.: 4 recebimentos seguintes sem a ocorrência; RQ 7.1 das últimas 2 semanas conforme.">
              <textarea value={verificacao} onChange={(e) => setVerificacao(e.target.value)} rows={2} className="campo" />
            </Campo>
            <Assinatura
              titulo="Assinatura do Responsável Técnico"
              declaracao={`Eu, ${nomeUsuario}, ${eficaz ? "verifiquei que a ação foi eficaz e encerro esta não conformidade" : "verifiquei que a ação NÃO foi eficaz; a NC volta para tratamento"}.`}
              rotuloBotao={eficaz ? "Assinar encerramento" : "Assinar e reabrir tratamento"}
              perigo={!eficaz}
              pendente={pendente}
              onAssinar={(senha) => rodar(() => acaoVerificar(id, eficaz, verificacao, senha))}
            />
          </section>
        ) : (
          <Alerta tipo="info">Aguardando o RT verificar a eficácia da ação.</Alerta>
        ))}

      {pode.encerrar && (
        <div>
          {!cancelando ? (
            <button type="button" onClick={() => setCancelando(true)} className="text-sm text-slate-500 underline">Cancelar esta NC (registro indevido)</button>
          ) : (
            <section className="cartao space-y-3">
              <Campo rotulo="Justificativa do cancelamento *"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="campo" /></Campo>
              <Assinatura declaracao="O cancelamento fica registrado na trilha de auditoria." rotuloBotao="Assinar cancelamento" perigo pendente={pendente} onAssinar={(senha) => rodar(() => acaoCancelar(id, motivo, senha))} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
