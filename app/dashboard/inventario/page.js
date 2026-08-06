'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function InventarioPage() {
    const { user }   = useAuth();
    const router     = useRouter();
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [nombre,   setNombre]   = useState('');
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState('');

    const load = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('productos')
            .select('*')
            .order('nombre', { ascending: true });
        setItems(data ?? []);
        setLoading(false);
    }, [user]);

    useEffect(() => { load(); }, [load]);

    async function handleAdd(e) {
        e.preventDefault();
        const nombreLimpio = nombre.trim();
        if (!nombreLimpio) return setError('El nombre es requerido.');

        const yaExiste = items.some(p => p.nombre.toLowerCase() === nombreLimpio.toLowerCase());
        if (yaExiste) return setError('Ya existe un item con ese nombre.');

        setError('');
        setSaving(true);
        const { error: dbErr } = await supabase
            .from('productos')
            .insert({ user_id: user.id, nombre: nombreLimpio });
        setSaving(false);
        if (dbErr) return setError(dbErr.message);

        setNombre('');
        setShowForm(false);
        load();
    }

    async function toggleActivo(item) {
        await supabase.from('productos').update({ activo: !item.activo }).eq('id', item.id);
        load();
    }

    return (
        <div className="animate-fade-in space-y-5 max-w-md mx-auto">

            <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Mis viajes
            </button>

            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100">Inventario</h1>
                <button
                    onClick={() => { setShowForm(s => !s); setError(''); }}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors border-foreground/30 text-foreground hover:bg-muted"
                >
                    {showForm ? 'Cancelar' : '+ Nuevo item'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="card space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                            Nombre del item
                        </label>
                        <input
                            autoFocus
                            placeholder="ej: Tomate"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            className="auth-input"
                        />
                    </div>
                    {error && <p className="error-box">{error}</p>}
                    <button type="submit" disabled={saving} className="btn-primary text-sm py-2" style={{ borderRadius: '8px' }}>
                        {saving ? 'Guardando...' : 'Guardar item'}
                    </button>
                </form>
            )}

            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="py-10 flex justify-center">
                        <div className="w-6 h-6 rounded-full border-[3px] border-stone-200 border-t-foreground animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-stone-400 dark:text-slate-500 text-sm">
                            Sin items todavía. Crea el primero para usarlo en tus viajes.
                        </p>
                    </div>
                ) : (
                    items.map(item => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-3 px-4 border-b border-stone-100 dark:border-slate-700 last:border-0"
                        >
                            <p className={`text-sm font-medium ${item.activo ? 'text-stone-800 dark:text-slate-200' : 'text-stone-400 dark:text-slate-500 line-through'}`}>
                                {item.nombre}
                            </p>
                            <button
                                onClick={() => toggleActivo(item)}
                                className={`shrink-0 badge text-xs ${item.activo ? 'badge-blue' : 'badge-gray'}`}
                                title={item.activo ? 'Desactivar' : 'Activar'}
                            >
                                {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
