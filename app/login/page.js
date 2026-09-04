'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ERROR_MAP = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Confirma tu correo antes de ingresar.',
    'Too many requests': 'Demasiados intentos. Espera unos minutos.',
};

export default function LoginPage() {
    const { signIn } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password);
            router.replace('/dashboard');
        } catch (err) {
            setError(ERROR_MAP[err.message] ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background flex flex-col md:flex-row selection:bg-primary/20">
            {/* Brand / Visual Side */}
            <div className="hidden md:flex flex-1 relative bg-card border-r border-border items-center justify-center overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-gradient-to-tr from-primary to-primary-light rounded-2xl flex items-center justify-center shadow-xl mb-8 transform hover:scale-105 transition-all duration-300 ring-4 ring-primary/20">
                        <Sprout className="w-10 h-10 text-primary-foreground" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
                        kropflow
                    </h1>
                    <p className="text-lg text-muted-foreground text-balance max-w-md">
                        Gestión inteligente de rutas, finanzas e inventario en un ecosistema logístico conectado.
                    </p>
                </div>
            </div>

            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative animate-fade-in">
                <div className="absolute top-0 right-0 w-full h-1/2 bg-primary/5 rounded-full blur-[150px] -z-10" />

                <div className="w-full max-w-sm">
                    {/* Mobile Logo */}
                    <div className="flex md:hidden items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-gradient-to-tr from-primary to-primary-light rounded-xl flex items-center justify-center shadow-md">
                            <Sprout className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-bold text-foreground">kropflow</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">Bienvenido de nuevo</h2>
                        <p className="text-sm text-muted-foreground">Ingresa tus credenciales para acceder a tu panel de control.</p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                                Correo electrónico
                            </label>
                            <input
                                id="email" type="email" autoComplete="email" required
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="tu@correo.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-sm font-semibold text-foreground">
                                    Contraseña
                                </label>
                                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                            <input
                                id="password" type="password" autoComplete="current-password" required
                                value={password} onChange={e => setPassword(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2 animate-fade-in">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary w-full py-3 h-12 rounded-xl text-base shadow-lg shadow-primary/25 mt-2">
                            {loading
                                ? <><span className="w-5 h-5 rounded-full border-[3px] border-white/30 border-t-white animate-spin" /> Ingresando...</>
                                : 'Iniciar sesión'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
                        ¿No tienes una cuenta?{' '}
                        <Link href="/registro" className="text-primary hover:text-primary-dark hover:underline transition-all">
                            Regístrate ahora
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
