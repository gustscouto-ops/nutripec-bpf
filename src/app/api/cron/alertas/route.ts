import { enviarAlertas } from "@/lib/servicos/alertas";

/**
 * Disparo diário dos alertas (agende no provedor: Vercel Cron, GitHub Actions, crontab…):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://SEU_DOMINIO/api/cron/alertas
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ erro: "Não autorizado" }, { status: 401 });
  }
  const relatorio = await enviarAlertas({ urlBase: new URL(req.url).origin });
  return Response.json({ enviados: relatorio.length, relatorio });
}
