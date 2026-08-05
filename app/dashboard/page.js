'use client';
import { useAuth } from '@/context/AuthContext';

const STATS = [
    { label: 'Ventas hoy', value: '$0.00', icon: '💵', color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Productos', value: '—', icon: '🥬', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Último cierre', value: '—', icon: '🗂️', color: 'text-teal-700', bg: 'bg-teal-50' },
    { label: 'Tasa BCV', value: 'Bs —', icon: '📈', color: 'text-blue-700', bg: 'bg-blue-50' },
];

export default function DashboardPage() {
    const { profile, user } = useAuth();
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div className="animate-fade-in space-y-8">
            {/* Bienvenida */}
            <div>
                <h1 className="text-2xl font-bold text-green-900">
                    {saludo}, {profile?.full_name?.split(' ')[0] ?? 'bienvenido'} 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                    {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {STATS.map((stat) => (
                    <div key={stat.label} className={`card flex flex-col gap-3 ${stat.bg}`}>
                        <span className="text-2xl">{stat.icon}</span>
                        <div>
                            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Accesos rápidos */}
            <div>
                <h2 className="text-base font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { icon: '🗂️', title: 'Cierre de Caja', desc: 'Registra el cierre de tu turno', href: '/dashboard/cierre-caja', color: 'hover:border-green-400' },
                        { icon: '📦', title: 'Inventario', desc: 'Próximamente disponible', href: '#', color: 'hover:border-gray-300 opacity-60 cursor-default' },
                        { icon: '📊', title: 'Reportes', desc: 'Próximamente disponible', href: '#', color: 'hover:border-gray-300 opacity-60 cursor-default' },
                    ].map((item) => (
                        <a
                            key={item.title}
                            href={item.href}
                            className={`card border-2 border-transparent transition-all group ${item.color}`}
                        >
                            <span className="text-3xl block mb-2">{item.icon}</span>
                            <h3 className="font-semibold text-gray-800 group-hover:text-green-700 transition-colors">{item.title}</h3>
                            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
