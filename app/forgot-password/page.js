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

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-green-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                        <span className="text-4xl">🥦</span>
                    </div>
                    <h1 className="text-3xl font-bold text-green-800 tracking-tight">Feria de Vegetales</h1>
                </div>

                <div className="card">
                    {sent ? (
                        <div className="text-center py-4">
                            <div className="text-5xl mb-4">📬</div>
                            <h2 className="text-lg font-bold text-green-800 mb-2">Correo enviado</h2>
                            <p className="text-sm text-gray-600 mb-6">
                                Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue el enlace para restablecer tu contraseña.
                            </p>
                            <Link href="/login" className="text-emerald-600 hover:underline text-sm font-medium">
                                ← Volver al inicio de sesión
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">Recuperar contraseña</h2>
                            <p className="text-sm text-gray-500 mb-6">
                                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                            </p>
                            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                                <div>
                                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="forgot-email" type="email" required
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                        placeholder="tu@correo.com"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
                                )}

                                <button
                                    type="submit" disabled={loading}
                                    className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                            Enviando...
                                        </span>
                                    ) : 'Enviar enlace'}
                                </button>
                            </form>
                            <div className="mt-4 text-center">
                                <Link href="/login" className="text-sm text-emerald-600 hover:underline">
                                    ← Volver al inicio de sesión
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
