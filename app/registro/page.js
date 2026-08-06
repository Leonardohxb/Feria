'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
    const { signUp } = useAuth();

    const [fullName, setFullName] = useState('');
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [confirm,  setConfirm]  = useState('');
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState(false);
    const [loading,  setLoading]  = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (password.length < 6)      return setError('La contraseña debe tener al menos 6 caracteres.');
        if (password !== confirm)      return setError('Las contraseñas no coinciden.');
        setLoading(true);
        try {
            await signUp(email, password, fullName);
            setSuccess(true);
        } catch (err) {
            setError(err.message ?? 'No se pudo crear la cuenta. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <main className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center px-4 py-12">
                <div className="card max-w-sm w-full text-center animate-fade-in py-10">
                    <div className="text-4xl mb-4">📧</div>
                    <h2 className="text-lg font-semibold text-stone-900 dark:text-slate-100 mb-2 text-balance">Revisa tu correo</h2>
                    <p className="text-sm text-stone-500 dark:text-slate-400 mb-6">
                        Enviamos un enlace de confirmación a <strong className="text-stone-700 dark:text-slate-300">{email}</strong>
                    </p>
                    <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline transition-colors">
                        Ir al inicio de sesión →
                    </Link>
                </div>
            </main>
        );
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
                    <p className="text-sm text-stone-500 dark:text-slate-400 mt-1">Crear una cuenta</p>
                </div>

                {/* Card */}
                <div className="card">
                    <p className="text-base font-semibold text-stone-800 dark:text-slate-200 mb-5">Registro</p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                                Nombre completo
                            </label>
                            <input id="fullName" type="text" required autoComplete="name"
                                value={fullName} onChange={e => setFullName(e.target.value)}
                                className="auth-input" placeholder="Carlos Mendoza" />
                        </div>
                        <div>
                            <label htmlFor="reg-email" className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                                Correo electrónico
                            </label>
                            <input id="reg-email" type="email" required autoComplete="email"
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="auth-input" placeholder="tu@correo.com" />
                        </div>
                        <div>
                            <label htmlFor="reg-password" className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                                Contraseña
                            </label>
                            <input id="reg-password" type="password" required autoComplete="new-password"
                                value={password} onChange={e => setPassword(e.target.value)}
                                className="auth-input" placeholder="Mínimo 6 caracteres" />
                        </div>
                        <div>
                            <label htmlFor="confirm" className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                                Confirmar contraseña
                            </label>
                            <input id="confirm" type="password" required autoComplete="new-password"
                                value={confirm} onChange={e => setConfirm(e.target.value)}
                                className="auth-input" placeholder="Repite tu contraseña" />
                        </div>

                        {error && <p className="error-box">{error}</p>}

                        <button type="submit" disabled={loading} className="btn-primary mt-1">
                            {loading
                                ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creando cuenta...</>
                                : 'Crear cuenta'}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-stone-500 dark:text-slate-400">
                        ¿Ya tienes cuenta?{' '}
                        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
