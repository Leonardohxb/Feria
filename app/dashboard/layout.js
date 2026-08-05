'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }) {
    const { user, profile, signOut, loading } = useAuth();
    const router   = useRouter();
    const pathname = usePathname();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-green-50">
                <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
            </div>
        );
    }

    function navClass(href) {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return `px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
            active
                ? 'text-green-700 bg-green-100'
                : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
        }`;
    }

    return (
        <div className="min-h-screen flex flex-col bg-green-50">
            <header className="bg-white border-b border-green-100 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                    >
                        <span className="text-2xl">🥦</span>
                        <span className="font-bold text-green-800 text-lg hidden sm:block">Feria de Vegetales</span>
                    </button>

                    <nav className="flex items-center gap-1">
                        <button onClick={() => router.push('/dashboard')} className={navClass('/dashboard')}>
                            Inicio
                        </button>
                        <button onClick={() => router.push('/dashboard/viajes/nuevo')} className={navClass('/dashboard/viajes/nuevo')}>
                            + Nuevo Viaje
                        </button>
                    </nav>

                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 hidden sm:block truncate max-w-[140px]">
                            {profile?.full_name ?? user?.email}
                        </span>
                        <button
                            onClick={signOut}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all border border-red-100"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
                {children}
            </main>

            <footer className="text-center text-xs text-gray-400 py-4">
                © {new Date().getFullYear()} Feria de Vegetales
            </footer>
        </div>
    );
}
