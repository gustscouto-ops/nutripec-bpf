import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "@/components/registrar-sw";

export const metadata: Metadata = {
  title: { default: "NutriPEC Gestão BPF", template: "%s · NutriPEC BPF" },
  description: "Gestão da Qualidade e Boas Práticas de Fabricação para fábricas de ração (IN MAPA 04/2007).",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
  appleWebApp: { capable: true, title: "NutriPEC BPF", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#17824a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
