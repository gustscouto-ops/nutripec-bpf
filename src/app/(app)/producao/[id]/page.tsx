import { exigirCtx } from "@/lib/auth";
import { Alerta, Cabecalho, BotaoLink } from "@/components/ui";
import { EtiquetasLote } from "@/components/etiquetas-lote";
import { BotaoImprimir } from "@/components/imprimir";
import { RastreioProduto } from "@/components/rastreio-produto";

export const metadata = { title: "Ordem de produção" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { id } = await params;
  const { novo } = await searchParams;
  const ctx = await exigirCtx();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Cabecalho titulo="Ordem de produção" acoes={<><BotaoLink href={`/expedicao?lote=${id}`}>Registrar expedição</BotaoLink><EtiquetasLote ordemId={id} tenantId={ctx.tenantId} /><BotaoImprimir /></>} />
      {novo && <Alerta tipo="sucesso">Ordem assinada. Lotes de matéria-prima vinculados para rastreabilidade.</Alerta>}
      <RastreioProduto tenantId={ctx.tenantId} ordemId={id} />
    </div>
  );
}
