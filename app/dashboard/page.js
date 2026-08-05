'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const [viajes,  setViajes]  = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('viajes')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => { setViajes(data ?? []); setLoading(false); });
    }, [user]);

    const hora    = new Date().getHours();
    const saludo  = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const activos = viajes.filter(v => v.estado === 'activo').length;

    return (
        <div className="animate-fade-in space-y-7">

            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100 text-balance">
                        {saludo}, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'}
                    </h1>
                    <p className="text-sm text-stone-500 dark:text-slate-400 mt-0.5">
                        {new Date().toLocaleDateString('es-VE', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/viajes/nuevo')}
                    className="shrink-0 btn-secondary"
                    style={{ width: 'auto', paddingLeft: '1rem', paddingRight: '1rem' }}
                >
                    + Nuevo viaje
                </button>
            </div>

            {/* Stats — solo cuando hay viajes */}
            {viajes.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="card flex items-center gap-3 py-3 px-4">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-lg shrink-0">🚛</div>
                        <div>
                            <p className="text-xl font-semibold text-stone-900 dark:text-slate-100 tabular">{viajes.length}</p>
                            <p className="text-xs text-stone-500 dark:text-slate-400">Viajes totales</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-3 py-3 px-4">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-lg shrink-0">📍</div>
                        <div>
                            <p className="text-xl font-semibold text-stone-900 dark:text-slate-100 tabular">{activos}</p>
                            <p className="text-xs text-stone-500 dark:text-slate-400">En curso</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista */}
            <section>
                <h2 className="text-sm font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Tus viajes
                </h2>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card py-4 flex items-center gap-3">
                                <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-2/3 rounded" />
                                    <div className="skeleton h-3 w-1/3 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : viajes.length === 0 ? (
                    <div className="card text-center py-14 border-dashed">
                        <p className="text-4xl mb-3">🚛</p>
                        <p className="text-stone-700 dark:text-slate-300 font-medium mb-1">Sin viajes todavía</p>
                        <p className="text-sm text-stone-400 dark:text-slate-500 mb-6 max-w-xs mx-auto text-balance">
                            Crea tu primer viaje para comenzar a registrar compras, ventas y costos.
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/viajes/nuevo')}
                            className="btn-primary mx-auto"
                            style={{ width: 'auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
                        >
                            Crear primer viaje
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {viajes.map(v => (
                            <button
                                key={v.id}
                                onClick={() => router.push(`/dashboard/viajes/${v.id}`)}
                                className="w-full card text-left hover:border-blue-300 hover:shadow-sm group transition-all py-3.5 px-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 flex items-center justify-center text-base shrink-0 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                                        🚛
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-stone-900 dark:text-slate-100 text-sm truncate group-hover:text-blue-700 transition-colors">
                                                {v.nombre}
                                            </p>
                                        </div>
                                        <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">
                                            {new Date(v.fecha_inicio + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            {v.fecha_fin && ` — ${new Date(v.fecha_fin + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}`}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 badge text-xs ${v.estado === 'activo' ? 'badge-blue' : 'badge-gray'}`}>
                                        {v.estado === 'activo' ? 'Activo' : 'Cerrado'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
