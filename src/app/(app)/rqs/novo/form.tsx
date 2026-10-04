"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checklist } from "@/components/checklist";
import { Assinatura } from "@/components/assinatura";
import { Fotos, anexarFotos, type Foto } from "@/components/fotos";
import { Alerta, Campo } from "@/components/ui";
import { avaliarRespostas, type CampoRq, type Respostas } from "@/lib/rq/campos";
import { acaoRegistrarRq } from "../actions";

type Modelo = { id: string; codigoRq: string; titulo: string; versao: number; popNumero: number; popTitulo: string; frequencia: string; agendado: boolean };

export function FormRq({
  modelo,
  campos,
  referencia,
  maxFotos,
  usuario,
  chaveRascunho,
  its,
}: {
  modelo: Modelo;
  campos: CampoRq[];
  referencia: { rotulo: string; atrasado: boolean; chave: string };
  maxFotos: number;
  usuario: string;
  chaveRascunho: string;
  its: { id: string; codigo: string; titulo: string }[];
}) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<Respostas>({});
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendente, iniciar] = useTransition();
  const avaliacao = avaliarRespostas(campos, respostas);

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    try {
      const r = JSON.parse(localStorage.getItem(chaveRascunho) ?? "null");
      if (r) {
        setRespostas(r.respostas ?? {});
        setObservacoes(r.observacoes ?? "");
      }
    } catch {}
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, [chaveRascunho]);
  useEffect(() => {
    try {
      if (Object.keys(respostas).length || observacoes) localStorage.setItem(chaveRascunho, JSON.stringify({ respostas, observacoes }));
    } catch {}
  }, [respostas, observacoes, chaveRascunho]);

  function revisar() {
    setErro(null);
    setErros(avaliacao.erros);
    if (Object.keys(avaliacao.erros).length) {
      setErro("Responda todos os itens. Toda não conformidade exige descrição e ação corretiva imediata.");
      return;
    }
    setAssinando(true);
    setTimeout(() => document.getElementById("assinatura")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function assinar(senha: string) {
    setErro(null);
    const fd = new FormData();
    fd.set("senha", senha);
    fd.set("dados", JSON.stringify({ modeloId: modelo.id, referencia: referencia.chave, respostas, observacoes }));
    anexarFotos(fd, fotos);
    iniciar(async () => {
      const r = await acaoRegistrarRq(fd);
      if (!r.ok) {
        setErro(r.erro);
        if (r.campos) {
          setErros(r.campos);
          setAssinando(false);
        }
        return;
      }
      try {
        localStorage.removeItem(chaveRascunho);
      } catch {}
      router.push(`/rqs/${r.dados!.id}?novo=1`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <div>
        <div className="text-xs font-semibold tracking-wide text-marca-700 uppercase">
          POP {String(modelo.popNumero).padStart(2, "0")} · {modelo.popTitulo}
        </div>
        <h1 className="text-2xl font-bold">
          {modelo.codigoRq} — {modelo.titulo}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{modelo.frequencia}</span>
          <span>· referência: {referencia.rotulo}</span>
          <span>· formulário v{modelo.versao}</span>
          <span>· {usuario}</span>
        </div>
      </div>

      {referencia.atrasado && (
        <Alerta tipo="aviso">
          Preenchimento <b>fora do prazo</b> ({referencia.rotulo}). O registro ficará marcado como atrasado no histórico e no PDF.
        </Alerta>
      )}
      {!online && <Alerta tipo="aviso">Sem conexão. As respostas ficam salvas neste aparelho; a assinatura é liberada quando a rede voltar.</Alerta>}
      {its.length > 0 && (
        <div className="cartao py-3 text-sm">
          <span className="font-semibold">Instruções de trabalho: </span>
          {its.map((i, n) => (
            <span key={i.id}>
              {n > 0 && " · "}
              <a href={`/instrucoes/${i.id}`} target="_blank" className="link">
                {i.codigo} {i.titulo}
              </a>
            </span>
          ))}
        </div>
      )}

      <Checklist
        campos={campos}
        respostas={respostas}
        onChange={(r) => {
          setRespostas(r);
          setAssinando(false);
        }}
        erros={Object.fromEntries(Object.entries(erros).filter(([k]) => avaliacao.erros[k]))}
      />

      <section className="cartao space-y-4">
        <Campo rotulo="Observações gerais">
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="campo" />
        </Campo>
        <div>
          <div className="rotulo">Evidências fotográficas (opcional, até {maxFotos})</div>
          <Fotos fotos={fotos} onChange={setFotos} max={maxFotos} />
        </div>
      </section>

      {erro && <Alerta>{erro}</Alerta>}

      {!assinando ? (
        <button type="button" onClick={revisar} className="btn-primario w-full">
          Revisar e assinar
        </button>
      ) : (
        <div id="assinatura" className="space-y-3">
          {avaliacao.status === "CONFORME" ? (
            <Alerta tipo="sucesso">Todos os itens conformes.</Alerta>
          ) : (
            <Alerta tipo="erro">
              <b>{avaliacao.naoConformidades.length} não conformidade(s)</b>: {avaliacao.naoConformidades.map((n) => n.rotulo).join("; ")}. Cada uma abrirá uma NC para o RT tratar
              (causa raiz, ação preventiva e eficácia).
            </Alerta>
          )}
          <Assinatura
            declaracao={`Eu, ${usuario}, declaro que realizei as verificações do ${modelo.codigoRq} referentes a ${referencia.rotulo} e que as informações são verdadeiras.`}
            pendente={pendente || !online}
            onAssinar={assinar}
          />
        </div>
      )}
    </div>
  );
}
