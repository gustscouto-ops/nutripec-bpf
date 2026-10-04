"use server";

import { revalidatePath } from "next/cache";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { ErroNegocio, executar } from "@/lib/erros";
import { registrarExecucaoRq } from "@/lib/servicos/rq";
import type { Respostas } from "@/lib/rq/campos";

export async function acaoRegistrarRq(form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    await validarAssinatura(ctx, String(form.get("senha") ?? ""));
    let dados: { modeloId: string; referencia?: string | null; respostas: Respostas; observacoes?: string };
    try {
      dados = JSON.parse(String(form.get("dados")));
    } catch {
      throw new ErroNegocio("Dados do formulário inválidos.");
    }
    const arquivos = form.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
    const descricoes = form.getAll("descricoes").map(String);
    const fotos = await Promise.all(arquivos.map(async (f, i) => ({ conteudo: Buffer.from(await f.arrayBuffer()), mimeType: f.type, descricao: descricoes[i] })));
    const { execucao, ncs } = await registrarExecucaoRq(ctx, {
      modeloId: dados.modeloId,
      referencia: dados.referencia,
      respostas: dados.respostas,
      observacoes: dados.observacoes,
      fotos,
    });
    return { id: execucao.id, ncs: ncs.length };
  });
  if (r.ok) {
    revalidatePath("/tarefas");
    revalidatePath("/rqs");
  }
  return r;
}
