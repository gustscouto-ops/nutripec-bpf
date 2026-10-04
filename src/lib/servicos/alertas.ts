import nodemailer from "nodemailer";
import { prisma } from "../db";
import { chaveDia } from "../agenda";
import { tarefas } from "./rq";

/**
 * Alertas de pendências para o RT (e quem marcar "receber alertas"): RQs atrasados, NCs vencidas,
 * lotes em quarentena e fórmulas sem aprovação. Canais: e-mail (SMTP) e WhatsApp (API HTTP).
 * Sem configuração de canal, o envio é apenas registrado como SIMULADA (útil em homologação).
 * Cada destinatário recebe no máximo um resumo por dia (tabela notificacoes).
 */

export type Pendencias = Awaited<ReturnType<typeof pendencias>>;

export async function pendencias(tenantId: string, agora = new Date()) {
  const [t, ncsAbertas, ncsVencidas, quarentena, formulas] = await Promise.all([
    tarefas(tenantId, agora),
    prisma.naoConformidade.count({ where: { tenantId, status: { in: ["ABERTA", "EM_TRATAMENTO", "AGUARDANDO_VERIFICACAO"] } } }),
    prisma.naoConformidade.findMany({
      where: { tenantId, status: { in: ["ABERTA", "EM_TRATAMENTO"] }, prazo: { lt: agora } },
      select: { numero: true, titulo: true, prazo: true },
    }),
    prisma.loteMateriaPrima.findMany({ where: { tenantId, status: "QUARENTENA" }, select: { codigoLoteInterno: true } }),
    prisma.produto.count({ where: { tenantId, ativo: true, statusFormula: { not: "APROVADA" } } }),
  ]);
  const semPlano = await prisma.naoConformidade.count({ where: { tenantId, status: "ABERTA" } });
  return { atrasadas: t.atrasadas, ncsAbertas, ncsSemPlano: semPlano, ncsVencidas, quarentena, formulas };
}

export function temPendencia(p: Pendencias) {
  return p.atrasadas.length + p.ncsVencidas.length + p.quarentena.length + p.ncsSemPlano > 0;
}

export function montarMensagem(empresa: string, p: Pendencias, urlBase: string) {
  const linhas: string[] = [];
  if (p.atrasadas.length) {
    linhas.push(`• ${p.atrasadas.length} RQ(s) atrasado(s):`);
    for (const t of p.atrasadas.slice(0, 10)) linhas.push(`   - ${t.modelo.codigoRq} ${t.modelo.titulo} (${t.periodo.rotulo})`);
    if (p.atrasadas.length > 10) linhas.push(`   - e mais ${p.atrasadas.length - 10}`);
  }
  if (p.ncsSemPlano) linhas.push(`• ${p.ncsSemPlano} não conformidade(s) sem plano de ação`);
  if (p.ncsVencidas.length) linhas.push(`• ${p.ncsVencidas.length} NC(s) com prazo vencido: ${p.ncsVencidas.map((n) => `NC ${n.numero}`).join(", ")}`);
  if (p.quarentena.length) linhas.push(`• ${p.quarentena.length} lote(s) em quarentena: ${p.quarentena.map((l) => l.codigoLoteInterno).join(", ")}`);
  if (p.formulas) linhas.push(`• ${p.formulas} fórmula(s) aguardando aprovação do RT`);
  const assunto = `[NutriPEC BPF] ${empresa}: ${p.atrasadas.length} RQ(s) atrasado(s), ${p.ncsAbertas} NC(s) abertas`;
  const texto = `Pendências de BPF — ${empresa}\n\n${linhas.join("\n")}\n\nAbrir o painel: ${urlBase}/tarefas`;
  return { assunto, texto };
}

type Envio = { canal: "EMAIL" | "WHATSAPP"; destino: string };

async function enviar(envio: Envio, assunto: string, texto: string): Promise<"ENVIADA" | "SIMULADA"> {
  if (envio.canal === "EMAIL") {
    if (!process.env.SMTP_HOST) return "SIMULADA";
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === "465",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporte.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: envio.destino, subject: assunto, text: texto });
    return "ENVIADA";
  }
  // WhatsApp: qualquer provedor que aceite POST JSON {to, message} (Z-API, Twilio via proxy, Meta Cloud API via função)
  if (!process.env.WHATSAPP_API_URL) return "SIMULADA";
  const r = await fetch(process.env.WHATSAPP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.WHATSAPP_API_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` } : {}) },
    body: JSON.stringify({ to: envio.destino, message: `${assunto}\n\n${texto}` }),
  });
  if (!r.ok) throw new Error(`WhatsApp HTTP ${r.status}`);
  return "ENVIADA";
}

/** Envia o resumo diário de pendências. Idempotente por dia e destinatário. */
export async function enviarAlertas(opcoes: { tenantId?: string; agora?: Date; urlBase?: string; forcar?: boolean } = {}) {
  const agora = opcoes.agora ?? new Date();
  const urlBase = opcoes.urlBase ?? process.env.APP_URL ?? "http://localhost:3000";
  const chave = `resumo-${chaveDia(agora)}`;
  const tenants = await prisma.tenant.findMany({ where: opcoes.tenantId ? { id: opcoes.tenantId } : {}, select: { id: true, razaoSocial: true, nomeFantasia: true } });
  const relatorio: { empresa: string; destino: string; canal: string; status: string; erro?: string }[] = [];

  for (const t of tenants) {
    const p = await pendencias(t.id, agora);
    if (!temPendencia(p)) continue;
    const empresa = t.nomeFantasia ?? t.razaoSocial;
    const { assunto, texto } = montarMensagem(empresa, p, urlBase);
    const membros = await prisma.membership.findMany({ where: { tenantId: t.id, ativo: true, receberAlertas: true, user: { ativo: true } }, include: { user: true } });
    for (const m of membros) {
      const envios: Envio[] = [{ canal: "EMAIL", destino: m.user.email }];
      if (m.user.telefone) envios.push({ canal: "WHATSAPP", destino: m.user.telefone });
      for (const envio of envios) {
        const ja = await prisma.notificacao.findUnique({ where: { tenantId_canal_destino_chave: { tenantId: t.id, canal: envio.canal, destino: envio.destino, chave } } });
        if (ja && !opcoes.forcar) continue;
        let status: string;
        let erro: string | undefined;
        try {
          status = await enviar(envio, assunto, texto);
        } catch (e) {
          status = "FALHA";
          erro = (e as Error).message;
        }
        await prisma.notificacao.upsert({
          where: { tenantId_canal_destino_chave: { tenantId: t.id, canal: envio.canal, destino: envio.destino, chave } },
          create: { tenantId: t.id, canal: envio.canal, destino: envio.destino, chave, assunto, status, erro },
          update: { assunto, status, erro, createdAt: new Date() },
        });
        relatorio.push({ empresa, destino: envio.destino, canal: envio.canal, status, erro });
      }
    }
  }
  return relatorio;
}
