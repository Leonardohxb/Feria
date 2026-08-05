'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await resetPassword(email);
            setSent(true);
        } catch (err) {
            setError(err.message ?? 'Error al enviar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <main className="min-h-screen bg-[#fafaf9] flex items-center justify-center px-4 py-12">
                <div className="card max-w-sm w-full text-center animate-fade-in py-10">
                    <div className="text-4xl mb-4">📧</div>
                    <h2 className="text-lg font-semibold text-stone-900 mb-2 text-balance">Revisa tu correo</h2>
                    <p className="text-sm text-stone-500 mb-6">
                        Enviamos un enlace de recuperación a <strong className="text-stone-700">{email}</strong>
                    </p>
                    <Link href="/login" className="text-sm font-medium text-green-700 hover:underline transition-colors">
                        ← Volver al inicio de sesión
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#fafaf9] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm animate-fade-in">

                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <span className="text-2xl">🥦</span>
                    </div>
                    <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Feria de Vegetales</h1>
                    <p className="text-sm text-stone-500 mt-1">Recuperar contraseña</p>
                </div>

                {/* Card */}
                <div className="card">
                    <p className="text-base font-semibold text-stone-800 mb-1.5">Recuperar contraseña</p>
                    <p className="text-sm text-stone-500 mb-5">
                        Ingresa tu correo y te enviaremos un enlace para restablecerla.
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label htmlFor="forgot-email" className="block text-sm font-medium text-stone-700 mb-1.5">
                                Correo electrónico
                            </label>
                            <input
                                id="forgot-email" type="email" required
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="auth-input"
                                placeholder="tu@correo.com"
                            />
                        </div>

                        {error && <p className="error-box">{error}</p>}

                        <button type="submit" disabled={loading} className="btn-primary mt-1">
                            {loading
                                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Enviando...</>
                                : 'Enviar enlace'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-stone-500">
                        <Link href="/login" className="font-medium text-green-700 hover:text-green-800 hover:underline transition-colors">
                            ← Volver al inicio de sesión
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
