'use client';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }) {
    const { user, profile, signOut, loading } = useAuth();
    const { dark, toggle } = useTheme();
    const router   = useRouter();
    const pathname = usePathname();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
                <div className="w-7 h-7 rounded-full border-[3px] border-stone-200 border-t-blue-600 animate-spin" />
            </div>
        );
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : (user?.email?.[0] ?? '?').toUpperCase();

    const isNewViaje = pathname === '/dashboard/viajes/nuevo';

    return (
        <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0f172a]">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-stone-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

                    {/* Logo */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
                    >
                        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm leading-none">🥦</span>
                        </div>
                        <span className="font-semibold text-stone-800 dark:text-slate-200 text-sm hidden sm:block tracking-tight">
                            Feria de Vegetales
                        </span>
                    </button>

                    {/* Nav */}
                    <nav className="flex items-center gap-1">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                pathname === '/dashboard'
                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-400'
                                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            Mis viajes
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/viajes/nuevo')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                isNewViaje
                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-400'
                                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            + Nuevo
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/inventario')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                pathname === '/dashboard/inventario'
                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-400'
                                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            Inventario
                        </button>
                    </nav>

                    {/* User */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
                                <span className="text-xs font-semibold text-blue-700">{initials}</span>
                            </div>
                            <span className="text-sm text-stone-600 dark:text-slate-400 max-w-[120px] truncate">
                                {profile?.full_name?.split(' ')[0] ?? user?.email}
                            </span>
                        </div>
                        <button
                            onClick={toggle}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-stone-200 dark:border-slate-700"
                            title={dark ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {dark ? '☀️' : '🌙'}
                        </button>
                        <button
                            onClick={signOut}
                            className="text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors border border-stone-200 dark:border-slate-700 hover:border-red-200"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
                {children}
            </main>

            <footer className="text-center text-xs text-stone-400 dark:text-slate-500 py-4 border-t border-stone-100 dark:border-slate-800">
                © {new Date().getFullYear()} Feria de Vegetales
            </footer>
        </div>
    );
}
