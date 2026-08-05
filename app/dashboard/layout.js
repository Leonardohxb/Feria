'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }) {
    const { user, profile, signOut, loading } = useAuth();
    const router = useRouter();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-green-50">
                <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
            </div>
        );
    }

    const roleLabel = profile?.role ?? 'usuario';
    const badgeClass = {
        admin: 'badge-admin',
        cajero: 'badge-cajero',
        dueño: 'badge-dueño',
    }[roleLabel] ?? 'badge-cajero';

    return (
        <div className="min-h-screen flex flex-col bg-green-50">
            {/* Navbar */}
            <header className="bg-white border-b border-green-100 sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🥦</span>
                        <span className="font-bold text-green-800 text-lg hidden sm:block">Feria de Vegetales</span>
                    </div>

                    <nav className="flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                        >
                            Inicio
                        </button>
                        {(roleLabel === 'cajero' || roleLabel === 'admin' || roleLabel === 'dueño') && (
                            <button
                                onClick={() => router.push('/dashboard/cierre-caja')}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                            >
                                Cierre de Caja
                            </button>
                        )}
                    </nav>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-sm font-medium text-gray-800">{profile?.full_name ?? user?.email}</span>
                            <span className={`badge ${badgeClass}`}>{roleLabel}</span>
                        </div>
                        <button
                            onClick={signOut}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all border border-red-100"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            {/* Contenido */}
            <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
                {children}
            </main>

            <footer className="text-center text-xs text-gray-400 py-4">
                © {new Date().getFullYear()} Feria de Vegetales
            </footer>
        </div>
    );
}
