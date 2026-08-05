'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const SUPABASE_ERRORS = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Debes confirmar tu correo antes de ingresar.',
    'Too many requests': 'Demasiados intentos. Espera unos minutos.',
};

function parseError(message) {
    return SUPABASE_ERRORS[message] ?? 'Ocurrió un error. Intenta de nuevo.';
}

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
            setError(parseError(err.message));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-green-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                        <span className="text-4xl">🥦</span>
                    </div>
                    <h1 className="text-3xl font-bold text-green-800 tracking-tight">Feria de Vegetales</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestión de productos y ventas</p>
                </div>

                {/* Card */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-800 mb-6">Iniciar sesión</h2>
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Correo electrónico
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                placeholder="tu@correo.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-sm shadow-green-200
                         hover:shadow-md hover:shadow-green-300"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Ingresando...
                                </span>
                            ) : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div className="mt-5 flex flex-col items-center gap-2 text-sm">
                        <Link href="/forgot-password" className="text-emerald-600 hover:text-emerald-700 hover:underline transition">
                            ¿Olvidaste tu contraseña?
                        </Link>
                        <span className="text-gray-400">¿No tienes cuenta?{' '}
                            <Link href="/registro" className="text-emerald-600 hover:underline font-medium">Regístrate</Link>
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
}
