import { exigirCtx } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pode } from "@/lib/permissions";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { Navegacao, type ItemMenu } from "@/components/navegacao";
import { sair } from "../login/actions";
import Link from "next/link";
import { tarefas } from "@/lib/servicos/rq";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await exigirCtx();
  const [vinculos, agenda, ncsAbertas] = await Promise.all([
    prisma.membership.count({ where: { userId: ctx.userId, ativo: true } }),
    tarefas(ctx.tenantId),
    prisma.naoConformidade.count({ where: { tenantId: ctx.tenantId, status: { in: ["ABERTA", "EM_TRATAMENTO", "AGUARDANDO_VERIFICACAO"] } } }),
  ]);
  const multiEmpresa = vinculos > 1;
  const atrasadas = agenda.atrasadas.length;

  const itens: ItemMenu[] = [
    { href: "/", rotulo: "Painel", icone: "painel" },
    { href: "/tarefas", rotulo: "Tarefas do dia", icone: "tarefas", contador: atrasadas || undefined },
    { href: "/recebimento", rotulo: "Recebimento (RQ 1.2)", icone: "caminhao" },
    { href: "/producao", rotulo: "Produção", icone: "fabrica" },
    { href: "/expedicao", rotulo: "Expedição", icone: "saida" },
    { href: "/rastreabilidade", rotulo: "Rastreabilidade", icone: "rastreio" },
    { secao: "Qualidade" },
    { href: "/rqs", rotulo: "Registros (RQs)", icone: "pop" },
    { href: "/nao-conformidades", rotulo: "Não conformidades", icone: "alerta", contador: ncsAbertas || undefined },
    { href: "/pops", rotulo: "POPs, RQs e ITs", icone: "livro" },
    { secao: "Cadastros" },
    { href: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
    { href: "/materias-primas", rotulo: "Matérias-primas", icone: "saco" },
    { href: "/produtos", rotulo: "Produtos e fórmulas", icone: "formula" },
    { secao: "Gestão" },
    ...(pode(ctx.perfil, "auditoria:ver") ? [{ href: "/auditoria", rotulo: "Trilha de auditoria", icone: "auditoria" } as ItemMenu] : []),
    ...(pode(ctx.perfil, "usuarios:gerenciar") ? [{ href: "/usuarios", rotulo: "Usuários", icone: "usuarios" } as ItemMenu] : []),
    ...(pode(ctx.perfil, "empresa:configurar") ? [{ href: "/configuracoes", rotulo: "Configurações", icone: "config" } as ItemMenu] : []),
  ];

  const rodape = (
    <div className="border-t border-white/10 p-4 text-sm">
      <div className="font-semibold text-white">{ctx.nome}</div>
      <div className="text-marca-100">{ROTULO_PERFIL[ctx.perfil]}</div>
      <div className="mt-3 flex gap-2">
        {multiEmpresa && (
          <Link href="/selecionar-empresa" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
            Trocar fábrica
          </Link>
        )}
        <form action={sair}>
          <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">Sair</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <Navegacao itens={itens} empresa={ctx.tenantNome} rodape={rodape} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
