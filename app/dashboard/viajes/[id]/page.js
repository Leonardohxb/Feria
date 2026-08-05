'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const UNIDADES    = ['kg', 'caja', 'unidad', 'saco', 'paca', 'otro'];
const TIPOS_COSTO = ['administracion', 'obreros', 'comida', 'hotel', 'gasolina', 'gasoil', 'transporte', 'otro'];
const TIPO_ICON   = { administracion: '📋', obreros: '👷', comida: '🍽️', hotel: '🏨', gasolina: '⛽', gasoil: '🛢️', transporte: '🚛', otro: '📌' };

const TABS = [
    { id: 'compras', label: '🛒 Compras' },
    { id: 'ventas',  label: '💰 Ventas'  },
    { id: 'costos',  label: '📋 Costos'  },
    { id: 'resumen', label: '📊 Resumen' },
];

function fmt(n) {
    return Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-VE');
}

// ── Compras Tab ─────────────────────────────────────────────────────────────
function ComprasTab({ viajeId, readOnly }) {
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setForm] = useState({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });

    const load = useCallback(async () => {
        const { data } = await supabase.from('compras').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function setField(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('compras').insert({
            viaje_id: viajeId,
            producto: form.producto,
            cantidad: Number(form.cantidad),
            unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha,
            notas: form.notas || null,
        });
        setForm({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function handleDelete(id) {
        await supabase.from('compras').delete().eq('id', id);
        load();
    }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    {items.length} {items.length === 1 ? 'registro' : 'registros'} · Total:{' '}
                    <strong className="text-orange-700">${fmt(total)}</strong>
                </p>
                {!readOnly && (
                    <button
                        onClick={() => setShowForm(s => !s)}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-all"
                    >
                        {showForm ? '✕ Cancelar' : '+ Agregar'}
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="card bg-orange-50 border border-orange-200 space-y-3">
                    <p className="text-sm font-semibold text-orange-800">Nueva Compra</p>
                    <div className="grid grid-cols-2 gap-3">
                        <input required placeholder="Producto (ej: Tomate)" value={form.producto} onChange={setField('producto')}
                            className="col-span-2 input-base" />
                        <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={setField('cantidad')}
                            className="input-base" />
                        <select value={form.unidad} onChange={setField('unidad')} className="input-base">
                            {UNIDADES.map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={setField('precio_unitario')}
                            className="input-base" />
                        <input type="date" value={form.fecha} onChange={setField('fecha')} className="input-base" />
                        <input placeholder="Notas (opcional)" value={form.notas} onChange={setField('notas')}
                            className="col-span-2 input-base" />
                    </div>
                    {form.cantidad && form.precio_unitario && (
                        <p className="text-sm text-orange-700 font-medium">
                            Subtotal: ${fmt(Number(form.cantidad) * Number(form.precio_unitario))}
                        </p>
                    )}
                    <button type="submit" disabled={saving}
                        className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold py-2 rounded-xl text-sm transition-all">
                        {saving ? 'Guardando...' : 'Guardar Compra'}
                    </button>
                </form>
            )}

            {loading
                ? <Spinner color="border-t-orange-600" />
                : items.length === 0
                    ? <EmptyState msg="No hay compras registradas." />
                    : <ItemList items={items} onDelete={!readOnly ? handleDelete : null}
                        renderLine={(i) => `${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                    />
            }
        </div>
    );
}

// ── Ventas Tab ───────────────────────────────────────────────────────────────
function VentasTab({ viajeId, readOnly }) {
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setForm] = useState({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });

    const load = useCallback(async () => {
        const { data } = await supabase.from('ventas').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function setField(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('ventas').insert({
            viaje_id: viajeId,
            producto: form.producto,
            cantidad: Number(form.cantidad),
            unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha,
            notas: form.notas || null,
        });
        setForm({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function handleDelete(id) {
        await supabase.from('ventas').delete().eq('id', id);
        load();
    }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    {items.length} {items.length === 1 ? 'registro' : 'registros'} · Total:{' '}
                    <strong className="text-green-700">${fmt(total)}</strong>
                </p>
                {!readOnly && (
                    <button
                        onClick={() => setShowForm(s => !s)}
                        className="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-all"
                    >
                        {showForm ? '✕ Cancelar' : '+ Agregar'}
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="card bg-green-50 border border-green-200 space-y-3">
                    <p className="text-sm font-semibold text-green-800">Nueva Venta</p>
                    <div className="grid grid-cols-2 gap-3">
                        <input required placeholder="Producto (ej: Tomate)" value={form.producto} onChange={setField('producto')}
                            className="col-span-2 input-base" />
                        <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={setField('cantidad')}
                            className="input-base" />
                        <select value={form.unidad} onChange={setField('unidad')} className="input-base">
                            {UNIDADES.map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={setField('precio_unitario')}
                            className="input-base" />
                        <input type="date" value={form.fecha} onChange={setField('fecha')} className="input-base" />
                        <input placeholder="Notas (opcional)" value={form.notas} onChange={setField('notas')}
                            className="col-span-2 input-base" />
                    </div>
                    {form.cantidad && form.precio_unitario && (
                        <p className="text-sm text-green-700 font-medium">
                            Subtotal: ${fmt(Number(form.cantidad) * Number(form.precio_unitario))}
                        </p>
                    )}
                    <button type="submit" disabled={saving}
                        className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-2 rounded-xl text-sm transition-all">
                        {saving ? 'Guardando...' : 'Guardar Venta'}
                    </button>
                </form>
            )}

            {loading
                ? <Spinner color="border-t-green-600" />
                : items.length === 0
                    ? <EmptyState msg="No hay ventas registradas." />
                    : <ItemList items={items} onDelete={!readOnly ? handleDelete : null}
                        renderLine={(i) => `${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                    />
            }
        </div>
    );
}

// ── Costos Tab ───────────────────────────────────────────────────────────────
function CostosTab({ viajeId, readOnly }) {
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [form, setForm] = useState({ tipo: 'obreros', descripcion: '', monto: '', fecha: today() });

    const load = useCallback(async () => {
        const { data } = await supabase.from('costos_adicionales').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function setField(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('costos_adicionales').insert({
            viaje_id: viajeId,
            tipo: form.tipo,
            descripcion: form.descripcion,
            monto: Number(form.monto),
            fecha: form.fecha,
        });
        setForm({ tipo: 'obreros', descripcion: '', monto: '', fecha: today() });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function handleDelete(id) {
        await supabase.from('costos_adicionales').delete().eq('id', id);
        load();
    }

    const total = items.reduce((s, i) => s + Number(i.monto), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    {items.length} {items.length === 1 ? 'registro' : 'registros'} · Total:{' '}
                    <strong className="text-blue-700">${fmt(total)}</strong>
                </p>
                {!readOnly && (
                    <button
                        onClick={() => setShowForm(s => !s)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-all"
                    >
                        {showForm ? '✕ Cancelar' : '+ Agregar'}
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="card bg-blue-50 border border-blue-200 space-y-3">
                    <p className="text-sm font-semibold text-blue-800">Nuevo Costo</p>
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.tipo} onChange={setField('tipo')} className="input-base">
                            {TIPOS_COSTO.map(t => (
                                <option key={t} value={t}>{TIPO_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>
                        <input type="date" value={form.fecha} onChange={setField('fecha')} className="input-base" />
                        <input required placeholder="Descripción" value={form.descripcion} onChange={setField('descripcion')}
                            className="col-span-2 input-base" />
                        <input required type="number" step="0.01" min="0" placeholder="Monto ($)" value={form.monto} onChange={setField('monto')}
                            className="col-span-2 input-base" />
                    </div>
                    <button type="submit" disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2 rounded-xl text-sm transition-all">
                        {saving ? 'Guardando...' : 'Guardar Costo'}
                    </button>
                </form>
            )}

            {loading
                ? <Spinner color="border-t-blue-600" />
                : items.length === 0
                    ? <EmptyState msg="No hay costos adicionales registrados." />
                    : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div key={item.id} className="card py-3 px-4 flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span>{TIPO_ICON[item.tipo] ?? '📌'}</span>
                                            <p className="font-medium text-gray-800 text-sm truncate">{item.descripcion}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {item.tipo} · <strong>${fmt(item.monto)}</strong> · {fmtDate(item.fecha)}
                                        </p>
                                    </div>
                                    {!readOnly && (
                                        <button onClick={() => handleDelete(item.id)}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all shrink-0 text-sm">
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
            }
        </div>
    );
}

// ── Resumen Tab ──────────────────────────────────────────────────────────────
function ResumenTab({ viajeId }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [cRes, vRes, kRes] = await Promise.all([
                supabase.from('compras').select('cantidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('ventas').select('cantidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('costos_adicionales').select('monto').eq('viaje_id', viajeId),
            ]);
            const totalCompras = (cRes.data ?? []).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalVentas  = (vRes.data ?? []).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalCostos  = (kRes.data ?? []).reduce((s, i) => s + Number(i.monto), 0);
            setData({ totalCompras, totalVentas, totalCostos });
            setLoading(false);
        }
        load();
    }, [viajeId]);

    if (loading) return <Spinner color="border-t-purple-600" />;

    const { totalCompras, totalVentas, totalCostos } = data;
    const gananciaBruta = totalVentas - totalCompras;
    const gananciaNeta  = gananciaBruta - totalCostos;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon="💰" label="Total Ventas"         value={totalVentas}  color="text-green-700"  bg="bg-green-50"  />
                <StatCard icon="🛒" label="Total Compras"        value={totalCompras} color="text-orange-700" bg="bg-orange-50" />
                <StatCard icon="📋" label="Costos Adicionales"   value={totalCostos}  color="text-blue-700"   bg="bg-blue-50"  />
            </div>

            <div className="card space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cálculo de ganancia</p>
                <Row label="Ingresos por ventas"   value={`+ $${fmt(totalVentas)}`}  color="text-green-700"  />
                <Row label="Costo de compras"       value={`− $${fmt(totalCompras)}`} color="text-orange-700" />
                <div className="border-t border-gray-100 pt-2">
                    <Row label="Ganancia bruta" bold
                        value={(gananciaBruta >= 0 ? '+ ' : '') + `$${fmt(gananciaBruta)}`}
                        color={gananciaBruta >= 0 ? 'text-green-700' : 'text-red-600'} />
                </div>
                <Row label="Costos adicionales"    value={`− $${fmt(totalCostos)}`}  color="text-blue-700"   />
                <div className="border-t-2 border-gray-300 pt-2">
                    <Row label="Ganancia neta" bold large
                        value={(gananciaNeta >= 0 ? '+ ' : '') + `$${fmt(gananciaNeta)}`}
                        color={gananciaNeta >= 0 ? 'text-green-700' : 'text-red-600'} />
                </div>
            </div>

            {totalVentas === 0 && totalCompras === 0 && (
                <div className="card bg-gray-50 text-center text-sm text-gray-400 py-6">
                    Aún no hay registros en este viaje.
                </div>
            )}
            {gananciaNeta < 0 && totalVentas > 0 && (
                <div className="card bg-red-50 border border-red-200">
                    <p className="text-sm text-red-700">
                        ⚠️ Este viaje tuvo una pérdida de <strong>${fmt(Math.abs(gananciaNeta))}</strong>. Los costos superan los ingresos.
                    </p>
                </div>
            )}
            {gananciaNeta >= 0 && totalVentas > 0 && (
                <div className="card bg-green-50 border border-green-200">
                    <p className="text-sm text-green-700">
                        ✅ Ganancia neta del viaje: <strong>${fmt(gananciaNeta)}</strong>
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function Spinner({ color }) {
    return (
        <div className="py-10 flex justify-center">
            <div className={`w-7 h-7 rounded-full border-4 border-gray-100 ${color} animate-spin`} />
        </div>
    );
}

function EmptyState({ msg }) {
    return <p className="text-center text-gray-400 py-10 text-sm">{msg}</p>;
}

function ItemList({ items, onDelete, renderLine }) {
    return (
        <div className="space-y-2">
            {items.map(item => (
                <div key={item.id} className="card py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{item.producto}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{renderLine(item)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(item.fecha)}{item.notas ? ` · ${item.notas}` : ''}
                        </p>
                    </div>
                    {onDelete && (
                        <button onClick={() => onDelete(item.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all shrink-0 text-sm">
                            ✕
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

function StatCard({ icon, label, value, color, bg }) {
    return (
        <div className={`card ${bg} space-y-1`}>
            <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>${fmt(value)}</p>
        </div>
    );
}

function Row({ label, value, color, bold, large }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className={bold ? 'font-semibold text-gray-800' : 'text-gray-600'}>{label}</span>
            <span className={`font-mono ${color} ${bold ? 'font-bold' : 'font-semibold'} ${large ? 'text-xl' : ''}`}>{value}</span>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ViajeDetallePage() {
    const { id }   = useParams();
    const router   = useRouter();
    const [viaje, setViaje]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('compras');
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        supabase.from('viajes').select('*').eq('id', id).single()
            .then(({ data }) => { setViaje(data); setLoading(false); });
    }, [id]);

    async function handleCerrar() {
        if (!confirm('¿Cerrar este viaje? Podrás ver el resumen pero no agregar más registros.')) return;
        setClosing(true);
        const fecha_fin = today();
        await supabase.from('viajes').update({ estado: 'cerrado', fecha_fin }).eq('id', id);
        setViaje(v => ({ ...v, estado: 'cerrado', fecha_fin }));
        setClosing(false);
        setActiveTab('resumen');
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
            </div>
        );
    }

    if (!viaje) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-400">Viaje no encontrado.</p>
                <button onClick={() => router.push('/dashboard')} className="mt-4 text-green-700 underline text-sm">
                    Volver al inicio
                </button>
            </div>
        );
    }

    const isClosed = viaje.estado === 'cerrado';

    return (
        <div className="animate-fade-in space-y-5">
            {/* Encabezado del viaje */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-sm text-gray-400 hover:text-gray-600 mb-1 block transition-colors"
                    >
                        ← Mis Viajes
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold text-green-900">🚛 {viaje.nombre}</h1>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isClosed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                            {isClosed ? 'Cerrado' : 'Activo'}
                        </span>
                    </div>
                    {viaje.descripcion && (
                        <p className="text-sm text-gray-500 mt-0.5">{viaje.descripcion}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                        Inicio: {fmtDate(viaje.fecha_inicio)}
                        {viaje.fecha_fin && ` · Fin: ${fmtDate(viaje.fecha_fin)}`}
                    </p>
                </div>

                {!isClosed && (
                    <button
                        onClick={handleCerrar}
                        disabled={closing}
                        className="shrink-0 text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 transition-all disabled:opacity-50"
                    >
                        {closing ? '...' : '✓ Cerrar Viaje'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === tab.id
                                ? 'bg-white shadow-sm text-gray-800'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Contenido del tab activo */}
            {activeTab === 'compras' && <ComprasTab viajeId={id} readOnly={isClosed} />}
            {activeTab === 'ventas'  && <VentasTab  viajeId={id} readOnly={isClosed} />}
            {activeTab === 'costos'  && <CostosTab  viajeId={id} readOnly={isClosed} />}
            {activeTab === 'resumen' && <ResumenTab viajeId={id} />}
        </div>
    );
}
