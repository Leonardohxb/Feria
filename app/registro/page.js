'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sprout, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
    const { signUp } = useAuth();

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
        if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
        if (password !== confirm) return setError('Las contraseñas no coinciden.');
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
            <main className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
                <div className="bg-card/70 backdrop-blur-xl border border-border shadow-2xl max-w-sm w-full rounded-2xl text-center py-12 px-6 animate-fade-in relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                            <Mail className="w-10 h-10 text-primary" strokeWidth={1.5} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-3 text-balance tracking-tight">Revisa tu correo</h2>
                    <p className="text-base text-muted-foreground mb-8">
                        Enviamos un enlace de confirmación a <strong className="text-foreground">{email}</strong>
                    </p>
                    <Link href="/login" className="inline-flex items-center justify-center gap-2 w-full btn-primary h-12 !font-semibold">
                        Ir al inicio de sesión <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col md:flex-row-reverse selection:bg-primary/20">
            {/* Brand / Visual Side (Reversed for differentiation) */}
            <div className="hidden md:flex flex-1 relative bg-card border-l border-border items-center justify-center overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-gradient-to-tr from-secondary to-primary-light rounded-2xl flex items-center justify-center shadow-xl mb-8 transform hover:-scale-x-100 hover:scale-105 transition-all duration-500 ring-4 ring-primary/20">
                        <Sprout className="w-10 h-10 text-primary-foreground" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
                        Únete
                    </h1>
                    <p className="text-lg text-muted-foreground text-balance max-w-sm">
                        Optimiza y fortalece el flujo logístico de tu empresa desde el primer día.
                    </p>
                </div>
            </div>

            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative animate-fade-in">
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-primary/5 rounded-full blur-[150px] -z-10" />

                <div className="w-full max-w-sm">
                    {/* Mobile Logo */}
                    <div className="flex md:hidden items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-gradient-to-tr from-primary to-primary-light rounded-xl flex items-center justify-center shadow-md">
                            <Sprout className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-bold text-foreground">kropflow</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">Crear nueva cuenta</h2>
                        <p className="text-sm text-muted-foreground">Comienza tu prueba de plataforma ahora.</p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="fullName" className="block text-sm font-semibold text-foreground">
                                Nombre completo
                            </label>
                            <input id="fullName" type="text" required autoComplete="name"
                                value={fullName} onChange={e => setFullName(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="Carlos Mendoza" />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="reg-email" className="block text-sm font-semibold text-foreground">
                                Correo electrónico
                            </label>
                            <input id="reg-email" type="email" required autoComplete="email"
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="tu@correo.com" />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="reg-password" className="block text-sm font-semibold text-foreground">
                                Contraseña
                            </label>
                            <input id="reg-password" type="password" required autoComplete="new-password"
                                value={password} onChange={e => setPassword(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="Mínimo 6 caracteres" />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="confirm" className="block text-sm font-semibold text-foreground">
                                Confirmar contraseña
                            </label>
                            <input id="confirm" type="password" required autoComplete="new-password"
                                value={confirm} onChange={e => setConfirm(e.target.value)}
                                className="auth-input bg-card/50 backdrop-blur-sm shadow-sm" placeholder="Repite tu contraseña" />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2 animate-fade-in">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary w-full py-3 h-12 rounded-xl text-base shadow-lg shadow-primary/25 mt-4">
                            {loading
                                ? <><span className="w-5 h-5 rounded-full border-[3px] border-white/30 border-t-white animate-spin" /> Creando...</>
                                : 'Crear cuenta'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
                        ¿Ya tienes una cuenta?{' '}
                        <Link href="/login" className="text-primary hover:text-primary-dark hover:underline transition-all">
                            Inicia sesión
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
