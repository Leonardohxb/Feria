'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PackagePlus, Box } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { ViewToggle, useViewPreference } from '@/app/dashboard/_components/ViewToggle';
import ProductCard from '@/app/dashboard/_components/ProductCard';

export default function InventarioPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [vista, setVista] = useViewPreference('inventario');

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
        <div className="animate-fade-in space-y-6 max-w-2xl mx-auto selection:bg-primary/20 relative">
            {/* Ambient Background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-sm h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />

            {/* Back Button */}
            <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
                <div className="p-1 rounded-md group-hover:bg-muted transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </div>
                Volver al Panel
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Inventario Global</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Administra los productos base disponibles para tus viajes.</p>
                </div>
                <div className="flex items-center gap-3">
                    <ViewToggle value={vista} onChange={setVista} />
                    <button
                        onClick={() => { setShowForm(s => !s); setError(''); }}
                        className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm ${showForm
                            ? 'bg-secondary text-foreground hover:bg-secondary/80'
                            : 'bg-primary text-primary-foreground hover:bg-primary-dark shadow-primary/20 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                    >
                        {showForm ? 'Cancelar' : <><PackagePlus className="w-4 h-4" /> Nuevo producto</>}
                    </button>
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-card/70 backdrop-blur-xl border border-border rounded-[20px] p-6 shadow-lg animate-fade-in">
                    <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Añadir Nuevo Producto</h2>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-1.5">
                                Nombre del producto
                            </label>
                            <input
                                autoFocus
                                placeholder="Ej: Tomate perita"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                className="auth-input bg-background/50 border-border shadow-sm placeholder:text-muted-foreground/50 h-11"
                            />
                        </div>
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium animate-fade-in flex items-center gap-2">
                                {error}
                            </div>
                        )}
                        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto h-11 font-semibold">
                            {saving ? (
                                <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Guardando...</>
                            ) : 'Guardar producto'}
                        </button>
                    </form>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-10 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-[3px] border-secondary border-t-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">Cargando inventario...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-card/40 backdrop-blur-xl border border-transparent rounded-3xl py-20 px-6 text-center shadow-none ring-1 ring-border border-dashed">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary shadow-sm">
                        <Box className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Inventario Vacío</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6 text-balance">
                        No has registrado ningún producto. Empieza por crear tu primer ítem para administrar tus viajes.
                    </p>
                    <button
                        onClick={() => { setShowForm(true); setError(''); }}
                        className="btn-primary mx-auto w-auto px-6 h-11"
                    >
                        Crear primer producto
                    </button>
                </div>
            ) : vista === 'tarjetas' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {items.map((item, idx) => (
                        <div key={item.id} className="relative group">
                            <ProductCard
                                title={item.nombre}
                                dimmed={!item.activo}
                                layout="vertical"
                                actions={
                                    <button
                                        onClick={() => toggleActivo(item)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors w-full ${item.activo
                                            ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                            : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10'
                                            }`}
                                        title={item.activo ? 'Desactivar producto' : 'Activar producto'}
                                    >
                                        {item.activo ? 'Activo' : 'Inactivo'}
                                    </button>
                                }
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-card/60 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-sm">
                    {items.map((item, i) => (
                        <div
                            key={item.id}
                            className={`flex items-center justify-between gap-4 py-3.5 px-5 group transition-colors ${i !== items.length - 1 ? 'border-b border-border/50' : ''
                                } hover:bg-muted/50`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.activo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    <Box className="w-4 h-4" />
                                </div>
                                <p className={`text-base font-semibold transition-all ${item.activo
                                    ? 'text-foreground group-hover:text-primary'
                                    : 'text-muted-foreground line-through opacity-75'
                                    }`}>
                                    {item.nombre}
                                </p>
                            </div>
                            <button
                                onClick={() => toggleActivo(item)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${item.activo
                                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
