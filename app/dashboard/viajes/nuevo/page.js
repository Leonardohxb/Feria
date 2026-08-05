'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function NuevoViajePage() {
    const { user } = useAuth();
    const router   = useRouter();
    const [form, setForm] = useState({
        nombre:      '',
        descripcion: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    function set(key) {
        return (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    }

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
        <div className="animate-fade-in max-w-lg mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                    ← Volver
                </button>
                <h1 className="text-xl font-bold text-green-900">Nuevo Viaje</h1>
            </div>

            <div className="card">
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre del viaje *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="ej: Viaje Barquisimeto agosto 2026"
                            value={form.nombre}
                            onChange={set('nombre')}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Notas sobre el destino, productos a buscar..."
                            value={form.descripcion}
                            onChange={set('descripcion')}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha de inicio *
                        </label>
                        <input
                            type="date"
                            required
                            value={form.fecha_inicio}
                            onChange={set('fecha_inicio')}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
                                   text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-sm"
                    >
                        {loading ? 'Creando viaje...' : 'Crear Viaje 🚛'}
                    </button>
                </form>
            </div>
        </div>
    );
}
