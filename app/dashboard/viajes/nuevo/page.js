'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function NuevoViajePage() {
    const { user }  = useAuth();
    const router    = useRouter();
    const [form, setForm] = useState({
        nombre:       '',
        descripcion:  '',
        fecha_inicio: new Date().toISOString().split('T')[0],
    });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.nombre.trim()) return setError('El nombre del viaje es requerido.');
        setError('');
        setLoading(true);
        try {
            const { data, error: dbErr } = await supabase
                .from('viajes')
                .insert({ ...form, user_id: user.id })
                .select()
                .single();
            if (dbErr) throw dbErr;
            router.push(`/dashboard/viajes/${data.id}`);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <div className="animate-fade-in max-w-md mx-auto">

            {/* Back */}
            <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 transition-colors mb-6"
            >
                <span>←</span> Mis viajes
            </button>

            <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100 mb-6">Nuevo viaje</h1>

            <div className="card">
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                            Nombre del viaje <span className="text-stone-400 dark:text-slate-500 font-normal">*</span>
                        </label>
                        <input
                            type="text" required
                            placeholder="ej: Barquisimeto — agosto 2026"
                            value={form.nombre} onChange={set('nombre')}
                            className="auth-input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                            Descripción <span className="text-stone-400 dark:text-slate-500 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Destino, productos objetivo, notas..."
                            value={form.descripcion} onChange={set('descripcion')}
                            className="auth-input resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                            Fecha de inicio <span className="text-stone-400 dark:text-slate-500 font-normal">*</span>
                        </label>
                        <input
                            type="date" required
                            value={form.fecha_inicio} onChange={set('fecha_inicio')}
                            className="auth-input"
                        />
                    </div>

                    {error && <p className="error-box">{error}</p>}

                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading
                            ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creando...</>
                            : 'Crear viaje'}
                    </button>
                </form>
            </div>
        </div>
    );
}
