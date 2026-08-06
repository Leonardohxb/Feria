'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const [viajes,  setViajes]  = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        async function load() {
            const [viajesR, comprasR, ventasR, costosR] = await Promise.all([
                supabase.from('viajes').select('*').order('created_at', { ascending: false }),
                supabase.from('compras').select('viaje_id,cantidad,precio_unitario'),
                supabase.from('ventas').select('viaje_id,cantidad,precio_unitario'),
                supabase.from('costos_adicionales').select('viaje_id,monto'),
            ]);

            // Agregación por viaje (respeta RLS: solo llegan filas del dueño)
            const acc = {};
            const ensure = id => (acc[id] ??= { compras: 0, ventas: 0, costos: 0 });
            (comprasR.data ?? []).forEach(c => { ensure(c.viaje_id).compras += Number(c.cantidad) * Number(c.precio_unitario); });
            (ventasR.data  ?? []).forEach(v => { ensure(v.viaje_id).ventas  += Number(v.cantidad) * Number(v.precio_unitario); });
            (costosR.data  ?? []).forEach(k => { ensure(k.viaje_id).costos  += Number(k.monto); });

            const conTotales = (viajesR.data ?? []).map(v => {
                const t = acc[v.id] ?? { compras: 0, ventas: 0, costos: 0 };
                return { ...v, ...t, ganancia: t.ventas - t.compras - t.costos };
            });

            setViajes(conTotales);
            setLoading(false);
        }
        load();
    }, [user]);

    const hora    = new Date().getHours();
    const saludo  = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const activos = viajes.filter(v => v.estado === 'activo').length;

    // Resumen global acumulado
    const totalVentas   = viajes.reduce((s, v) => s + v.ventas, 0);
    const totalInvertido = viajes.reduce((s, v) => s + v.compras + v.costos, 0);
    const gananciaTotal = totalVentas - totalInvertido;

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

            {/* Resumen global — solo cuando hay viajes */}
            {!loading && viajes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`stat-tile ${gananciaTotal >= 0 ? 'stat-green' : 'stat-red'}`}>
                        <p className="stat-label">Ganancia total</p>
                        <p className="stat-value">{gananciaTotal >= 0 ? '+' : '−'}${fmt(Math.abs(gananciaTotal))}</p>
                    </div>
                    <div className="stat-tile stat-blue">
                        <p className="stat-label">Total vendido</p>
                        <p className="stat-value">${fmt(totalVentas)}</p>
                    </div>
                    <div className="stat-tile stat-orange">
                        <p className="stat-label">Total invertido</p>
                        <p className="stat-value">${fmt(totalInvertido)}</p>
                    </div>
                    <div className="stat-tile">
                        <p className="stat-label">Viajes · en curso</p>
                        <p className="stat-value text-stone-800 dark:text-slate-100">{viajes.length} · {activos}</p>
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
                        {viajes.map(v => {
                            const sinDatos = v.ventas === 0 && v.compras === 0 && v.costos === 0;
                            return (
                                <button
                                    key={v.id}
                                    onClick={() => router.push(`/dashboard/viajes/${v.id}`)}
                                    className="w-full card text-left hover:border-ring hover:shadow-sm group transition-all py-3.5 px-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="icon-chip group-hover:border-ring transition-colors">🚛</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-stone-900 dark:text-slate-100 text-sm truncate group-hover:text-foreground transition-colors">
                                                {v.nombre}
                                            </p>
                                            <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">
                                                {new Date(v.fecha_inicio + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                {v.fecha_fin && ` — ${new Date(v.fecha_fin + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}`}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className={`badge text-xs ${v.estado === 'activo' ? 'badge-blue' : 'badge-gray'}`}>
                                                {v.estado === 'activo' ? 'Activo' : 'Cerrado'}
                                            </span>
                                            {!sinDatos && (
                                                <span className={`text-sm font-semibold tabular ${v.ganancia >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'}`}>
                                                    {v.ganancia >= 0 ? '+' : '−'}${fmt(Math.abs(v.ganancia))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
