import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Cabecalho, Selo } from "@/components/ui";
import { dataHora } from "@/lib/formato";
import { BotaoTestarAlertas } from "./alertas";
import { FormEmpresa } from "./form";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const ctx = await exigirCtx("empresa:configurar");
  const [t, destinatarios, envios] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
    prisma.membership.findMany({ where: { tenantId: ctx.tenantId, ativo: true, receberAlertas: true }, include: { user: { select: { nome: true, email: true, telefone: true } } } }),
    prisma.notificacao.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const emailReal = !!process.env.SMTP_HOST;
  const whatsReal = !!process.env.WHATSAPP_API_URL;
  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho titulo="Configurações da empresa" subtitulo="Dados que aparecem na folha timbrada dos PDFs e regras de codificação de lotes." />
      <FormEmpresa
        inicial={{
          razaoSocial: t.razaoSocial,
          nomeFantasia: t.nomeFantasia ?? "",
          cnpj: t.cnpj,
          registroMapa: t.registroMapa ?? "",
          endereco: t.endereco ?? "",
          cidadeUf: t.cidadeUf ?? "",
          regraLoteMp: t.regraLoteMp,
          regraLoteProd: t.regraLoteProd,
        }}
      />

      <section className="cartao mt-6 space-y-4">
        <div>
          <h2 className="font-semibold">Alertas de pendências</h2>
          <p className="text-sm text-slate-600">
            Todo dia de manhã o sistema envia um resumo com RQs atrasados, RQs que vencem hoje e não conformidades abertas ou vencidas. Quem recebe é definido em{" "}
            <Link href="/usuarios" className="link">
              Usuários
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Selo cor={emailReal ? "verde" : "amarelo"}>E-mail: {emailReal ? "servidor SMTP configurado" : "modo simulação (sem SMTP)"}</Selo>
          <Selo cor={whatsReal ? "verde" : "amarelo"}>WhatsApp: {whatsReal ? "gateway configurado" : "modo simulação (sem gateway)"}</Selo>
        </div>
        <div>
          <div className="rotulo">Destinatários</div>
          {destinatarios.length ? (
            <ul className="text-sm">
              {destinatarios.map((d) => (
                <li key={d.id}>
                  {d.user.nome} · {d.user.email}
                  {d.user.telefone ? ` · WhatsApp ${d.user.telefone}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Ninguém marcado para receber alertas.</p>
          )}
        </div>
        <BotaoTestarAlertas />
        {envios.length > 0 && (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Canal</th>
                  <th>Destino</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id}>
                    <td>{dataHora(e.createdAt)}</td>
                    <td>{e.canal === "EMAIL" ? "E-mail" : "WhatsApp"}</td>
                    <td>{e.destino}</td>
                    <td>
                      <Selo cor={e.status === "ENVIADA" ? "verde" : e.status === "FALHA" ? "vermelho" : "amarelo"}>{e.status === "SIMULADA" ? "Simulada" : e.status === "ENVIADA" ? "Enviada" : "Falha"}</Selo>
                      {e.erro && <div className="text-xs text-red-600">{e.erro}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
