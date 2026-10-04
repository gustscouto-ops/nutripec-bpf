import { exigirCtx } from "@/lib/auth";
import { Cabecalho } from "@/components/ui";
import { BotaoImprimir } from "@/components/imprimir";
import { RastreioProduto } from "@/components/rastreio-produto";

export const metadata = { title: "Rastreabilidade do produto" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await exigirCtx();
  return (
    <div className="mx-auto max-w-6xl">
      <Cabecalho titulo="Rastreabilidade para trás" subtitulo={`${ctx.tenantNome} · do produto acabado ao fornecedor`} acoes={<BotaoImprimir />} />
      <RastreioProduto tenantId={ctx.tenantId} ordemId={id} />
    </div>
  );
}
