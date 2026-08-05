'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const ESTADO = {
    activo:  { label: 'Activo',  cls: 'bg-green-100 text-green-700' },
    cerrado: { label: 'Cerrado', cls: 'bg-gray-100 text-gray-500'  },
};

export default function DashboardPage() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const [viajes, setViajes]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('viajes')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                setViajes(data ?? []);
                setLoading(false);
            });
    }, [user]);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const activos = viajes.filter(v => v.estado === 'activo').length;

    return (
        <div className="animate-fade-in space-y-6">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-green-900">
                        {saludo}, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'} 👋
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {new Date().toLocaleDateString('es-VE', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        })}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/viajes/nuevo')}
                    className="shrink-0 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
                >
                    + Nuevo Viaje
                </button>
            </div>

            {/* Resumen rápido */}
            {viajes.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="card bg-green-50 flex flex-col gap-1">
                        <span className="text-2xl">🚛</span>
                        <p className="text-xl font-bold text-green-700">{viajes.length}</p>
                        <p className="text-xs text-gray-500">Viajes totales</p>
                    </div>
                    <div className="card bg-emerald-50 flex flex-col gap-1">
                        <span className="text-2xl">📍</span>
                        <p className="text-xl font-bold text-emerald-700">{activos}</p>
                        <p className="text-xs text-gray-500">En curso</p>
                    </div>
                </div>
            )}

            {/* Lista de viajes */}
            <div>
                <h2 className="text-base font-semibold text-gray-700 mb-3">Tus Viajes</h2>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
                    </div>
                ) : viajes.length === 0 ? (
                    <div className="card text-center py-14">
                        <p className="text-5xl mb-3">🚛</p>
                        <p className="text-gray-500 text-sm mb-1">No tienes viajes registrados todavía.</p>
                        <p className="text-gray-400 text-xs mb-5">Crea tu primer viaje para empezar a registrar compras y ventas.</p>
                        <button
                            onClick={() => router.push('/dashboard/viajes/nuevo')}
                            className="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
                        >
                            Crear primer viaje
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {viajes.map((v) => {
                            const badge = ESTADO[v.estado] ?? ESTADO.cerrado;
                            return (
                                <button
                                    key={v.id}
                                    onClick={() => router.push(`/dashboard/viajes/${v.id}`)}
                                    className="w-full card text-left hover:shadow-md border-2 border-transparent hover:border-green-200 transition-all group"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xl">🚛</span>
                                                <h3 className="font-semibold text-gray-800 group-hover:text-green-700 transition-colors truncate">
                                                    {v.nombre}
                                                </h3>
                                            </div>
                                            {v.descripcion && (
                                                <p className="text-xs text-gray-500 truncate pl-7">{v.descripcion}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1 pl-7">
                                                Inicio: {new Date(v.fecha_inicio + 'T00:00:00').toLocaleDateString('es-VE')}
                                                {v.fecha_fin && ` · Fin: ${new Date(v.fecha_fin + 'T00:00:00').toLocaleDateString('es-VE')}`}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
