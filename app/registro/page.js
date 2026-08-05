'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
    const { signUp } = useAuth();
    const router = useRouter();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            await signUp(email, password, fullName);
            setSuccess(true);
        } catch (err) {
            setError(err.message ?? 'Ocurrió un error. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-12">
                <div className="card max-w-md w-full text-center animate-fade-in">
                    <div className="text-5xl mb-4">📧</div>
                    <h2 className="text-xl font-bold text-green-800 mb-2">¡Registro exitoso!</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Revisa tu correo <strong>{email}</strong> y confirma tu cuenta para poder ingresar.
                    </p>
                    <Link href="/login" className="text-emerald-600 hover:underline text-sm font-medium">
                        Ir al inicio de sesión →
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-green-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                        <span className="text-4xl">🥦</span>
                    </div>
                    <h1 className="text-3xl font-bold text-green-800 tracking-tight">Feria de Vegetales</h1>
                    <p className="text-sm text-gray-500 mt-1">Crear una cuenta</p>
                </div>

                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-800 mb-6">Registro</h2>
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                            <input
                                id="fullName" type="text" required autoComplete="name"
                                value={fullName} onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="María González"
                            />
                        </div>
                        <div>
                            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                            <input
                                id="reg-email" type="email" required autoComplete="email"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="tu@correo.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                id="reg-password" type="password" required autoComplete="new-password"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                            <input
                                id="confirm" type="password" required autoComplete="new-password"
                                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                placeholder="Repite tu contraseña"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
                        )}

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-sm shadow-green-200 mt-1"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    Creando cuenta...
                                </span>
                            ) : 'Crear Cuenta'}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm">
                        <span className="text-gray-500">¿Ya tienes cuenta?{' '}
                            <Link href="/login" className="text-emerald-600 hover:underline font-medium">Inicia sesión</Link>
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
}
