import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'kropflow',
  description: 'Gestión de viajes de compra y venta de hortalizas',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={fontSans.variable} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function(){
            var s = localStorage.getItem('theme');
            var d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (d) document.documentElement.classList.add('dark');
          })()
        `}} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
