import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "Terreno · CRM Imobiliário",
  description: "Sistema imobiliário para gestão de loteamentos, lotes e vendas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
