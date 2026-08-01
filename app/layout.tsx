import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PURE — Sistema de Eficiencia Académica Multi-Universidad',
  description:
    'Dashboard de gestión para doble ingeniería: Aeroespacial + Software con Dosis Mínima Eficaz, Sinergias Temáticas e IA MCP.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased bg-[#070a12] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
