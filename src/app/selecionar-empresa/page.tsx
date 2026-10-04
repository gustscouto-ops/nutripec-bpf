import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sessaoAtual } from "@/lib/auth";
import { ROTULO_PERFIL } from "@/lib/permissions";
import { escolherEmpresa, sair } from "../login/actions";

export const metadata = { title: "Selecionar empresa" };

export default async function SelecionarEmpresa() {
  const s = await sessaoAtual();
  if (!s) redirect("/login");
  const vinculos = await prisma.membership.findMany({
    where: { userId: s.uid, ativo: true },
    include: { tenant: true },
    orderBy: { tenant: { razaoSocial: "asc" } },
  });
  return (
    <main className="mx-auto max-w-lg p-4 pt-12">
      <h1 className="text-2xl font-bold">Olá, {s.nome.split(" ")[0]}</h1>
      <p className="mb-6 text-slate-600">Escolha a fábrica em que deseja trabalhar.</p>
      <div className="space-y-3">
        {vinculos.map((v) => (
          <form key={v.id} action={escolherEmpresa.bind(null, v.tenantId)}>
            <button className="cartao w-full text-left transition hover:border-marca-500">
              <div className="font-semibold">{v.tenant.nomeFantasia ?? v.tenant.razaoSocial}</div>
              <div className="text-sm text-slate-600">
                CNPJ {v.tenant.cnpj} · {v.tenant.cidadeUf} · {ROTULO_PERFIL[v.perfil]}
              </div>
            </button>
          </form>
        ))}
      </div>
      <form action={sair} className="mt-6">
        <button className="btn-secundario">Sair</button>
      </form>
    </main>
  );
}
