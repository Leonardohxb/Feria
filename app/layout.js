import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'Feria de Vegetales',
  description: 'Sistema de gestión de productos, ventas y caja para la Feria de Vegetales',
  keywords: ['feria', 'vegetales', 'ventas', 'caja', 'inventario'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
