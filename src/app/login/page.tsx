import type { Metadata } from "next";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca-900 to-marca-700 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <img src="/icone.svg" alt="" className="mx-auto h-16 w-16" />
          <h1 className="mt-3 text-2xl font-bold">NutriPEC Gestão BPF</h1>
          <p className="text-sm text-marca-100">Qualidade e BPF na alimentação animal · IN MAPA 04/2007</p>
        </div>
        <div className="cartao">
          {erro === "acesso" && <p className="mb-3 text-sm text-red-700">Seu acesso a esta empresa foi revogado.</p>}
          <FormLogin />
        </div>
        <p className="mt-4 text-center text-xs text-marca-100">
          Demonstração: rt@nutripec.demo, operador@nutripec.demo, ceo@nutripec.demo, consultor@nutripec.demo ou auditor@nutripec.demo · senha nutripec123
        </p>
      </div>
    </main>
  );
}
