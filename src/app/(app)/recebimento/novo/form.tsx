"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checklist } from "@/components/checklist";
import { Assinatura } from "@/components/assinatura";
import { Alerta, Campo } from "@/components/ui";
import { avaliarRespostas, type CampoRq, type Respostas } from "@/lib/rq/campos";
import { aplicarRegraLote } from "@/lib/lote";
import { acaoRegistrarRecebimento } from "../actions";

type Opcao = {
  fornecedorId: string;
  fornecedor: string;
  cnpj: string;
  materiaPrimaId: string;
  materiaPrima: string;
  prefixo: string;
  umidadeMaxPct: number | null;
  temperaturaMaxC: number | null;
};

type Carga = {
  fornecedorId: string;
  materiaPrimaId: string;
  numeroNf: string;
  quantidadeKg: string;
  loteFornecedor: string;
  dataFabricacao: string;
  dataValidade: string;
  placaVeiculo: string;
  transportadora: string;
  motorista: string;
};

type Foto = { blob: Blob; url: string; descricao: string };

const VAZIA: Carga = {
  fornecedorId: "",
  materiaPrimaId: "",
  numeroNf: "",
  quantidadeKg: "",
  loteFornecedor: "",
  dataFabricacao: "",
  dataValidade: "",
  placaVeiculo: "",
  transportadora: "",
  motorista: "",
};

const ETAPAS = ["Carga", "Inspeção", "Fotos", "Assinatura"];

/** Reduz a foto da câmera (~1600 px, JPEG) antes do envio: economiza dados no Wi-Fi da fábrica. */
async function comprimir(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.8));
  } catch {
    return arquivo;
  }
}

export function FormRecebimento({
  opcoes,
  campos,
  titulo,
  regraLote,
  maxFotos,
  usuario,
  chaveRascunho,
}: {
  opcoes: Opcao[];
  campos: CampoRq[];
  titulo: string;
  regraLote: string;
  maxFotos: number;
  usuario: string;
  chaveRascunho: string;
}) {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);
  const [carga, setCarga] = useState<Carga>(VAZIA);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const [pendente, iniciar] = useTransition();

  // Relógio (o horário oficial é o do servidor no momento da assinatura) e status de rede
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 30000);
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  // Rascunho no aparelho: protege o preenchimento contra queda de Wi-Fi ou fechamento do app
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveRascunho);
      if (salvo) {
        const r = JSON.parse(salvo);
        setCarga({ ...VAZIA, ...r.carga });
        setRespostas(r.respostas ?? {});
        setObservacoes(r.observacoes ?? "");
        setRascunhoRestaurado(true);
      }
    } catch {}
  }, [chaveRascunho]);
  useEffect(() => {
    try {
      if (carga.fornecedorId || Object.keys(respostas).length) localStorage.setItem(chaveRascunho, JSON.stringify({ carga, respostas, observacoes }));
    } catch {}
  }, [carga, respostas, observacoes, chaveRascunho]);

  const fornecedores = useMemo(() => [...new Map(opcoes.map((o) => [o.fornecedorId, o])).values()], [opcoes]);
  const mpsDoFornecedor = opcoes.filter((o) => o.fornecedorId === carga.fornecedorId);
  const par = opcoes.find((o) => o.fornecedorId === carga.fornecedorId && o.materiaPrimaId === carga.materiaPrimaId);
  const limites = { umidadeMaxPct: par?.umidadeMaxPct ?? null, temperaturaMaxC: par?.temperaturaMaxC ?? null };
  const avaliacao = avaliarRespostas(campos, respostas, limites);
  const previaLote = par && agora ? aplicarRegraLote(regraLote, { PREFIXO: par.prefixo, data: agora, seq: 1 }) : null;

  const set = (k: keyof Carga) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCarga((c) => ({ ...c, [k]: e.target.value }));

  function avancar() {
    setErro(null);
    if (etapa === 0) {
      const e: Record<string, string> = {};
      if (!par) e.materiaPrimaId = "Selecione fornecedor e matéria-prima";
      if (!carga.numeroNf.trim()) e.numeroNf = "Obrigatório";
      if (!(Number(carga.quantidadeKg.replace(",", ".")) > 0)) e.quantidadeKg = "Informe o peso";
      setErros(e);
      if (Object.keys(e).length) return;
    }
    if (etapa === 1) {
      setErros(avaliacao.erros);
      if (Object.keys(avaliacao.erros).length) {
        setErro("Responda todos os itens. Toda não conformidade exige descrição e ação corretiva imediata.");
        return;
      }
    }
    setErros({});
    setEtapa((e) => e + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos) return;
    const livres = maxFotos - fotos.length;
    const novas = await Promise.all(
      [...arquivos].slice(0, livres).map(async (f) => {
        const blob = await comprimir(f);
        return { blob, url: URL.createObjectURL(blob), descricao: "" };
      }),
    );
    setFotos((fs) => [...fs, ...novas]);
  }

  function assinar(senha: string) {
    setErro(null);
    const fd = new FormData();
    fd.set("senha", senha);
    fd.set(
      "dados",
      JSON.stringify({
        ...carga,
        quantidadeKg: Number(carga.quantidadeKg.replace(",", ".")),
        respostas,
        observacoes,
      }),
    );
    fotos.forEach((f, i) => {
      fd.append("fotos", new File([f.blob], `foto-${i + 1}.jpg`, { type: f.blob.type || "image/jpeg" }));
      fd.append("descricoes", f.descricao);
    });
    iniciar(async () => {
      const r = await acaoRegistrarRecebimento(fd);
      if (!r.ok) {
        setErro(r.erro);
        if (r.campos) {
          setErros(r.campos);
          setEtapa(Object.keys(r.campos).some((k) => campos.some((c) => c.id === k)) ? 1 : 0);
        }
        return;
      }
      try {
        localStorage.removeItem(chaveRascunho);
      } catch {}
      router.push(`/recebimento/${r.dados!.id}?novo=1`);
    });
  }

  function descartarRascunho() {
    try {
      localStorage.removeItem(chaveRascunho);
    } catch {}
    setCarga(VAZIA);
    setRespostas({});
    setObservacoes("");
    setFotos([]);
    setEtapa(0);
    setRascunhoRestaurado(false);
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-4">
        <div className="text-xs font-semibold tracking-wide text-marca-700 uppercase">{titulo}</div>
        <h1 className="text-2xl font-bold">Recebimento de carga</h1>
        <div className="mt-1 text-sm text-slate-600">
          {agora?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} · {usuario}
        </div>
      </div>

      <ol className="mb-5 grid grid-cols-4 gap-1">
        {ETAPAS.map((e, i) => (
          <li key={e}>
            <button
              type="button"
              disabled={i > etapa}
              onClick={() => setEtapa(i)}
              className={`w-full rounded-lg py-2 text-xs font-semibold sm:text-sm ${i === etapa ? "bg-marca-600 text-white" : i < etapa ? "bg-marca-100 text-marca-900" : "bg-slate-200 text-slate-500"}`}
            >
              {i + 1}. {e}
            </button>
          </li>
        ))}
      </ol>

      {!online && <div className="mb-4"><Alerta tipo="aviso">Sem conexão. O rascunho fica salvo neste aparelho; a assinatura é liberada quando a rede voltar.</Alerta></div>}
      {rascunhoRestaurado && etapa === 0 && (
        <div className="mb-4">
          <Alerta tipo="info">
            Rascunho anterior restaurado.{" "}
            <button type="button" onClick={descartarRascunho} className="font-semibold underline">Começar do zero</button>
          </Alerta>
        </div>
      )}

      {etapa === 0 && (
        <section className="cartao space-y-4">
          {!opcoes.length && <Alerta tipo="aviso">Nenhum fornecedor aprovado com matéria-prima homologada. Cadastre em Fornecedores (POP 01).</Alerta>}
          <Campo rotulo="Fornecedor *">
            <select value={carga.fornecedorId} onChange={(e) => setCarga((c) => ({ ...c, fornecedorId: e.target.value, materiaPrimaId: "" }))} className="campo">
              <option value="">Selecione…</option>
              {fornecedores.map((f) => <option key={f.fornecedorId} value={f.fornecedorId}>{f.fornecedor} · {f.cnpj}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Matéria-prima *" erro={erros.materiaPrimaId} ajuda="Só aparecem as homologadas para o fornecedor.">
            <select value={carga.materiaPrimaId} onChange={set("materiaPrimaId")} className="campo" disabled={!carga.fornecedorId}>
              <option value="">Selecione…</option>
              {mpsDoFornecedor.map((o) => <option key={o.materiaPrimaId} value={o.materiaPrimaId}>{o.materiaPrima}</option>)}
            </select>
          </Campo>
          {previaLote && (
            <div className="rounded-lg bg-marca-50 p-3">
              <div className="text-xs font-semibold text-marca-700 uppercase">Lote interno (gerado automaticamente)</div>
              <div className="font-mono text-2xl font-bold text-marca-900">{previaLote}</div>
              <div className="text-xs text-slate-600">Confirmado no momento da assinatura (recebe sufixo se já houver outro igual no dia).</div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nº da nota fiscal *" erro={erros.numeroNf}><input value={carga.numeroNf} onChange={set("numeroNf")} inputMode="numeric" className="campo" /></Campo>
            <Campo rotulo="Peso total da carga (kg) *" erro={erros.quantidadeKg}><input value={carga.quantidadeKg} onChange={set("quantidadeKg")} inputMode="decimal" className="campo" /></Campo>
            <Campo rotulo="Lote do fornecedor"><input value={carga.loteFornecedor} onChange={set("loteFornecedor")} className="campo" /></Campo>
            <Campo rotulo="Placa do veículo"><input value={carga.placaVeiculo} onChange={set("placaVeiculo")} className="campo uppercase" /></Campo>
            <Campo rotulo="Data de fabricação"><input type="date" value={carga.dataFabricacao} onChange={set("dataFabricacao")} className="campo" /></Campo>
            <Campo rotulo="Data de validade"><input type="date" value={carga.dataValidade} onChange={set("dataValidade")} className="campo" /></Campo>
            <Campo rotulo="Transportadora"><input value={carga.transportadora} onChange={set("transportadora")} className="campo" /></Campo>
            <Campo rotulo="Motorista"><input value={carga.motorista} onChange={set("motorista")} className="campo" /></Campo>
          </div>
        </section>
      )}

      {etapa === 1 && (
        <section className="space-y-4">
          <Checklist campos={campos} respostas={respostas} onChange={setRespostas} limites={limites} erros={Object.fromEntries(Object.entries(erros).filter(([k]) => avaliacao.erros[k]))} />
          <div className="cartao">
            <Campo rotulo="Observações gerais"><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="campo" /></Campo>
          </div>
        </section>
      )}

      {etapa === 2 && (
        <section className="cartao space-y-4">
          <div>
            <h2 className="font-semibold">Evidência fotográfica</h2>
            <p className="text-sm text-slate-600">Até {maxFotos} fotos: caminhão, lona, carga, NF, laudo ou não conformidades.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((f, i) => (
              <div key={f.url} className="overflow-hidden rounded-lg border border-slate-200">
                <img src={f.url} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-1 p-2">
                  <input value={f.descricao} onChange={(e) => setFotos(fotos.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} placeholder="Descrição" className="campo py-1.5 text-sm" />
                  <button type="button" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="text-sm font-medium text-red-600">Remover</button>
                </div>
              </div>
            ))}
            {fotos.length < maxFotos && (
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-marca-500">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M3 8h3l2-3h8l2 3h3v12H3z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="mt-1 text-sm font-medium">Tirar foto</span>
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </section>
      )}

      {etapa === 3 && par && (
        <section className="space-y-4">
          <div className="cartao">
            <h2 className="mb-3 font-semibold">Resumo</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Fornecedor</dt><dd className="font-medium">{par.fornecedor}</dd></div>
              <div><dt className="text-slate-500">Matéria-prima</dt><dd className="font-medium">{par.materiaPrima}</dd></div>
              <div><dt className="text-slate-500">NF</dt><dd className="font-medium">{carga.numeroNf}</dd></div>
              <div><dt className="text-slate-500">Peso</dt><dd className="font-medium">{carga.quantidadeKg} kg</dd></div>
              <div><dt className="text-slate-500">Lote interno</dt><dd className="font-mono font-bold">{previaLote}</dd></div>
              <div><dt className="text-slate-500">Fotos</dt><dd className="font-medium">{fotos.length}</dd></div>
            </dl>
            <div className="mt-4">
              {avaliacao.status === "CONFORME" ? (
                <Alerta tipo="sucesso">Carga <b>conforme</b>. O lote será liberado para uso na produção.</Alerta>
              ) : (
                <Alerta tipo="erro">
                  <b>{avaliacao.naoConformidades.length} não conformidade(s)</b>: {avaliacao.naoConformidades.map((n) => n.rotulo).join("; ")}. O lote ficará em{" "}
                  <b>quarentena</b> até a decisão do RT.
                </Alerta>
              )}
            </div>
          </div>
          <Assinatura
            declaracao={`Eu, ${usuario}, declaro que realizei a inspeção desta carga e que as informações registradas são verdadeiras.`}
            pendente={pendente || !online}
            onAssinar={assinar}
          />
        </section>
      )}

      {erro && <div className="mt-4"><Alerta>{erro}</Alerta></div>}

      <div className="nao-imprimir fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl justify-between gap-2">
          <button type="button" onClick={() => setEtapa((e) => Math.max(0, e - 1))} disabled={etapa === 0} className="btn-secundario flex-1 sm:flex-none">
            Voltar
          </button>
          {etapa < 3 && (
            <button type="button" onClick={avancar} className="btn-primario flex-1 sm:flex-none">
              {etapa === 2 && !fotos.length ? "Seguir sem fotos" : "Avançar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
