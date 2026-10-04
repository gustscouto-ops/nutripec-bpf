"use server";

import { revalidatePath } from "next/cache";
import { exigirCtx, validarAssinatura } from "@/lib/auth";
import { ErroNegocio, executar } from "@/lib/erros";
import { decidirLote, registrarRecebimento, type RecebimentoInput } from "@/lib/servicos/recebimento";

export async function acaoRegistrarRecebimento(form: FormData) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("operacao:registrar");
    await validarAssinatura(ctx, String(form.get("senha") ?? ""));
    let dados: Omit<RecebimentoInput, "fotos">;
    try {
      dados = JSON.parse(String(form.get("dados")));
    } catch {
      throw new ErroNegocio("Dados do formulário inválidos.");
    }
    const arquivos = form.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
    const descricoes = form.getAll("descricoes").map(String);
    const fotos = await Promise.all(
      arquivos.map(async (f, i) => ({ conteudo: Buffer.from(await f.arrayBuffer()), mimeType: f.type, descricao: descricoes[i] })),
    );
    const { execucao, lote } = await registrarRecebimento(ctx, { ...dados, quantidadeKg: Number(dados.quantidadeKg), fotos });
    return { id: execucao.id, codigoLote: lote.codigoLoteInterno, status: execucao.status };
  });
  if (r.ok) revalidatePath("/recebimento");
  return r;
}

export async function acaoDecidirLote(loteId: string, decisao: "LIBERADO" | "REPROVADO", motivo: string, senha: string) {
  const r = await executar(async () => {
    const ctx = await exigirCtx("lote:decidir");
    await validarAssinatura(ctx, senha);
    await decidirLote(ctx, loteId, decisao, motivo);
  });
  if (r.ok) revalidatePath("/recebimento");
  return r;
}
