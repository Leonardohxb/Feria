'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, PlusCircle, TrendingUp, TrendingDown, DollarSign, Briefcase } from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { montoUsd, costoFinalPorKg, ventaTotal } from '@/lib/divisas.mjs';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const [viajes, setViajes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        async function load() {
            const [viajesR, comprasR, ventasR, costosR] = await Promise.all([
                supabase.from('viajes').select('*').order('created_at', { ascending: false }),
                supabase.from('compras').select('viaje_id,cantidad,unidad,precio_unitario, viaje_divisas(tasa)'),
                supabase.from('ventas').select('viaje_id,cantidad,precio_unitario,total_real'),
                supabase.from('costos_adicionales').select('viaje_id,monto, viaje_divisas(tasa)'),
            ]);

            const tasaViaje = Object.fromEntries((viajesR.data ?? []).map(v => [v.id, Number(v.traslado_tasa_por_kg) || 0]));
            const acc = {};
            const ensure = id => (acc[id] ??= { compras: 0, ventas: 0, costos: 0 });

            (comprasR.data ?? []).forEach(c => {
                const precioUsd = montoUsd(1, c.precio_unitario, c.viaje_divisas?.tasa ?? 1);
                const porKg = c.unidad === 'kg' ? costoFinalPorKg(precioUsd, tasaViaje[c.viaje_id] ?? 0) : precioUsd;
                ensure(c.viaje_id).compras += Number(c.cantidad) * porKg;
            });
            (ventasR.data ?? []).forEach(v => { ensure(v.viaje_id).ventas += ventaTotal(v.cantidad, v.precio_unitario, v.total_real); });
            (costosR.data ?? []).forEach(k => { ensure(k.viaje_id).costos += montoUsd(1, k.monto, k.viaje_divisas?.tasa ?? 1); });

            const conTotales = (viajesR.data ?? []).map(v => {
                const t = acc[v.id] ?? { compras: 0, ventas: 0, costos: 0 };
                return { ...v, ...t, ganancia: t.ventas - t.compras - t.costos };
            });

            setViajes(conTotales);
            setLoading(false);
        }
        load();
    }, [user]);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const activos = viajes.filter(v => v.estado === 'activo').length;

    const totalVentas = viajes.reduce((s, v) => s + v.ventas, 0);
    const totalInvertido = viajes.reduce((s, v) => s + v.compras + v.costos, 0);
    const gananciaTotal = totalVentas - totalInvertido;

    return (
        <div className="space-y-8 animate-fade-in relative">

            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
                        {saludo}, <span className="text-primary">{profile?.full_name?.split(' ')[0] ?? 'Compañero'}</span>
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground mt-1">
                        {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="shrink-0">
                    <button
                        onClick={() => router.push('/dashboard/viajes/nuevo')}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold px-6 py-3.5 rounded-full shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:bg-emerald-600 transition-all hover:-translate-y-0.5 active:scale-95 w-full md:w-auto"
                    >
                        <PlusCircle className="w-5 h-5" strokeWidth={2.5} />
                        Nuevo viaje
                    </button>
                </div>
            </div>

            {/* Resumen Global (KPI Cards) */}
            {!loading && viajes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
                        <div className="absolute top-0 right-0 p-4 opacity-15 sm:opacity-20 group-hover:opacity-30 transition-opacity">
                            {gananciaTotal >= 0 ? <TrendingUp className="w-16 h-16 text-emerald-500" /> : <TrendingDown className="w-16 h-16 text-rose-500" />}
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Ganancia neta</p>
                        <p className={`text-3xl font-black ${gananciaTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'} font-[var(--font-sans)]`}>
                            {gananciaTotal >= 0 ? '+' : '−'}$
                            {fmt(Math.abs(gananciaTotal))}
                        </p>
                    </div>

                    <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
                        <div className="absolute top-0 right-0 p-4 opacity-15 sm:opacity-20 group-hover:opacity-30 transition-opacity"><DollarSign className="w-16 h-16 text-primary" /></div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Ventas</p>
                        <p className="text-2xl font-bold text-foreground font-[var(--font-sans)]">${fmt(totalVentas)}</p>
                    </div>

                    <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
                        <div className="absolute top-0 right-0 p-4 opacity-15 sm:opacity-20 group-hover:opacity-30 transition-opacity"><Briefcase className="w-16 h-16 text-amber-500" /></div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Inversión (Costos)</p>
                        <p className="text-2xl font-bold text-foreground font-[var(--font-sans)]">${fmt(totalInvertido)}</p>
                    </div>

                    <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-3xl p-6 shadow-lg shadow-primary/20 hover:shadow-xl transition-all group">
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity"><Truck className="w-16 h-16" /></div>
                        <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Viajes Activos</p>
                        <p className="text-3xl font-black font-[var(--font-sans)]">{activos} <span className="text-lg opacity-75 font-semibold">/ {viajes.length}</span></p>
                    </div>
                </div>
            )}

            {/* Listado de Viajes */}
            <section className="mt-10 lg:mt-14">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 px-1">
                    <div>
                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Registro de viajes</h2>
                        <p className="text-sm font-medium text-muted-foreground mt-1">Historial completo de tus operaciones logísticas.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-card/40 backdrop-blur-xl border border-border/50 p-6 rounded-[28px] flex items-center gap-4">
                                <div className="skeleton w-14 h-14 rounded-2xl shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <div className="skeleton h-6 w-1/3 rounded-lg" />
                                    <div className="skeleton h-4 w-1/4 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : viajes.length === 0 ? (
                    <div className="text-center py-20 px-4 bg-card/20 backdrop-blur-xl border border-dashed border-border/60 rounded-[32px]">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Truck className="w-12 h-12 text-primary" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-3">No hay viajes registrados</h3>
                        <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-balance">
                            Comienza tu gestión logística creando el primer viaje. Podrás registrar compras, mermas y ventas al detalle.
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/viajes/nuevo')}
                            className="btn-primary mx-auto"
                            style={{ width: 'auto', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                        >
                            Crear tu primer viaje
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {viajes.map(v => {
                            const sinDatos = v.ventas === 0 && v.compras === 0 && v.costos === 0;
                            const isActivo = v.estado === 'activo';

                            return (
                                <button
                                    key={v.id}
                                    onClick={() => router.push(`/dashboard/viajes/${v.id}`)}
                                    className="w-full bg-card/40 backdrop-blur-xl hover:bg-card/80 border border-border/50 hover:border-border rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 group transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                >
                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                        <div className={`w-14 h-14 shrink-0 rounded-[20px] flex items-center justify-center transition-colors shadow-sm ring-1 ${isActivo ? 'bg-primary/10 text-primary ring-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary group-hover:shadow-primary/20' : 'bg-muted/50 text-muted-foreground ring-border/50 group-hover:bg-muted group-hover:text-foreground group-hover:ring-border'}`}>
                                            <Truck className="w-6 h-6" strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <p className="font-extrabold text-foreground text-lg truncate group-hover:text-primary transition-colors">
                                                    {v.nombre}
                                                </p>
                                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest ${isActivo ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20' : 'bg-transparent border border-border text-muted-foreground'}`}>
                                                    {isActivo ? 'Activo' : 'Cerrado'}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                {new Date(v.fecha_inicio + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                {v.fecha_fin && <span className="text-muted-foreground/50">—</span>}
                                                {v.fecha_fin && new Date(v.fecha_fin + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>

                                    {!sinDatos && (
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-border/50 pt-4 sm:pt-0 shrink-0 mt-2 sm:mt-0">
                                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5 sm:block hidden">Balance Neto</p>
                                            <span className={`text-2xl font-black tabular-nums tracking-tighter ${v.ganancia >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {v.ganancia >= 0 ? '+' : '−'}$
                                                {fmt(Math.abs(v.ganancia))}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
