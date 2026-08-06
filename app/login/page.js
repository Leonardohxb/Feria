'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const ERROR_MAP = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed':        'Confirma tu correo antes de ingresar.',
    'Too many requests':          'Demasiados intentos. Espera unos minutos.',
};

export default function LoginPage() {
    const { signIn } = useAuth();
    const router = useRouter();

    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

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
        <main className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm animate-fade-in">

                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <span className="text-2xl">🥦</span>
                    </div>
                    <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100 tracking-tight">Feria de Vegetales</h1>
                    <p className="text-sm text-stone-500 dark:text-slate-400 mt-1">Control de viajes y costos</p>
                </div>

                {/* Card */}
                <div className="card">
                    <p className="text-base font-semibold text-stone-800 dark:text-slate-200 mb-5">Iniciar sesión</p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                                Correo electrónico
                            </label>
                            <input
                                id="email" type="email" autoComplete="email" required
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="auth-input" placeholder="tu@correo.com"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className="text-sm font-medium text-stone-700 dark:text-slate-300">
                                    Contraseña
                                </label>
                                <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                                    ¿La olvidaste?
                                </Link>
                            </div>
                            <input
                                id="password" type="password" autoComplete="current-password" required
                                value={password} onChange={e => setPassword(e.target.value)}
                                className="auth-input" placeholder="••••••••"
                            />
                        </div>

                        {error && <p className="error-box">{error}</p>}

                        <button type="submit" disabled={loading} className="btn-primary mt-1">
                            {loading
                                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Ingresando...</>
                                : 'Iniciar sesión'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-stone-500 dark:text-slate-400">
                        ¿No tienes cuenta?{' '}
                        <Link href="/registro" className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                            Regístrate
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
