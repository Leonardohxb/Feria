import './globals.css';
import { Outfit } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'Feria de Vegetales',
  description: 'Gestión de viajes de compra y venta de hortalizas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={outfit.variable}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
