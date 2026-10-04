/** Erro de regra de negócio com mensagem pronta para o usuário (e erros por campo, quando houver). */
export class ErroNegocio extends Error {
  constructor(
    message: string,
    public campos?: Record<string, string>,
  ) {
    super(message);
    this.name = "ErroNegocio";
  }
}

export type ResultadoAcao<T = unknown> =
  | { ok: true; dados?: T; mensagem?: string }
  | { ok: false; erro: string; campos?: Record<string, string> };

/** Executa a ação e converte exceções em um resultado serializável para o formulário. */
export async function executar<T>(fn: () => Promise<T>, mensagem?: string): Promise<ResultadoAcao<T>> {
  try {
    const dados = await fn();
    return { ok: true, dados, mensagem };
  } catch (e) {
    if (e instanceof ErroNegocio) return { ok: false, erro: e.message, campos: e.campos };
    // redirect()/notFound() do Next precisam continuar propagando
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    const err = e as { code?: string; message?: string };
    if (err?.code === "P2002") return { ok: false, erro: "Já existe um registro com estes dados (código/CNPJ duplicado)." };
    console.error(e);
    return { ok: false, erro: err?.message ?? "Erro inesperado" };
  }
}
