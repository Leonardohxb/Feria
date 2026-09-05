'use client';
import { Sprout, Sun, Moon, LayoutDashboard, PlusCircle, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }) {
    const { user, profile, signOut, loading } = useAuth();
    const { dark, toggle } = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 rounded-full border-[3px] border-secondary border-t-primary animate-spin" />
            </div>
        );
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : (user?.email?.[0] ?? '?').toUpperCase();

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
        { name: 'Planificar Viaje', path: '/dashboard/viajes/nuevo', icon: PlusCircle },
        { name: 'Inventario', path: '/dashboard/inventario', icon: Package },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-background relative selection:bg-primary/20">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />

            {/* Premium Glass Header */}
            <header className="sticky top-4 z-50 max-w-5xl mx-auto w-full px-4 sm:px-6">
                <div className="bg-card/70 backdrop-blur-xl border border-border shadow-sm rounded-2xl h-16 flex items-center justify-between px-4 gap-4 transition-all duration-300">

                    {/* Brand / Logo */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0 group"
                    >
                        <div className="w-8 h-8 bg-gradient-to-tr from-[#022c22] to-primary-dark rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10">
                            <Sprout className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-foreground text-sm tracking-tight hidden sm:block">
                            kropflow
                        </span>
                    </button>

                    {/* Navigation */}
                    <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-background/50 border border-border/50">
                        {navItems.map((item) => {
                            const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.path}
                                    onClick={() => router.push(item.path)}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                                        ? 'text-primary-foreground bg-primary shadow-md'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
                                    <span className="hidden sm:inline">{item.name}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* User & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={toggle}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
                            title={dark ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-border">
                            <div className="text-right">
                                <p className="text-sm font-medium text-foreground leading-none">
                                    {profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0]}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-muted border border-border flex items-center justify-center shadow-inner">
                                <span className="text-xs font-bold text-foreground">{initials}</span>
                            </div>
                        </div>

                        <button
                            onClick={signOut}
                            className="text-xs font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 relative z-0 animate-fade-in">
                {children}
            </main>

            {/* Footer */}
            <footer className="text-center text-xs font-medium text-muted-foreground py-6 border-t border-border mt-auto">
                © {new Date().getFullYear()} Kropflow — Next-Gen logistics.
            </footer>
        </div>
    );
}
