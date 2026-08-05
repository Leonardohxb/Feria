'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

const UNIDADES    = ['kg', 'caja', 'unidad', 'saco', 'paca', 'otro'];
const TIPOS_COSTO = ['administracion', 'obreros', 'comida', 'hotel', 'gasolina', 'gasoil', 'transporte', 'otro'];
const TIPO_ICON   = { administracion: '📋', obreros: '👷', comida: '🍽️', hotel: '🏨', gasolina: '⛽', gasoil: '🛢️', transporte: '🚛', otro: '📌' };

const TABS = [
    { id: 'compras', label: 'Compras'  },
    { id: 'ventas',  label: 'Ventas'   },
    { id: 'costos',  label: 'Costos'   },
    { id: 'resumen', label: 'Resumen'  },
];

function fmt(n) {
    return Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); }

/* ── Shared primitives ──────────────────────────────────── */

function Spinner() {
    return (
        <div className="py-10 flex justify-center">
            <div className="w-6 h-6 rounded-full border-[3px] border-stone-200 border-t-blue-600 animate-spin" />
        </div>
    );
}

function EmptyState({ msg }) {
    return (
        <div className="py-12 text-center">
            <p className="text-stone-400 dark:text-slate-500 text-sm">{msg}</p>
        </div>
    );
}

function DeleteBtn({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
        >
            ✕
        </button>
    );
}

/* ── Add button ─────────────────────────────────────────── */
function AddButton({ onClick, open }) {
    return (
        <button
            onClick={onClick}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                open
                    ? 'border-stone-200 text-stone-500 hover:bg-stone-50'
                    : 'border-blue-600 text-blue-600 hover:bg-blue-50'
            }`}
        >
            {open ? 'Cancelar' : '+ Agregar'}
        </button>
    );
}

/* ── Item row ───────────────────────────────────────────── */
function ItemRow({ title, line, date, note, onDelete }) {
    return (
        <div className="flex items-start gap-3 py-3 px-4 border-b border-stone-100 dark:border-slate-700 last:border-0 group">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-slate-200">{title}</p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5 tabular">{line}</p>
                <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">{date}{note ? ` · ${note}` : ''}</p>
            </div>
            {onDelete && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DeleteBtn onClick={onDelete} />
                </div>
            )}
        </div>
    );
}

/* ── Section total badge ─────────────────────────────────── */
function SectionHeader({ count, total, color, children }) {
    return (
        <div className="flex items-center justify-between py-3 px-4 border-b border-stone-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-stone-700 dark:text-slate-300">{count} registro{count !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold tabular ${color}`}>${fmt(total)}</span>
                {children}
            </div>
        </div>
    );
}

/* ── Inline form ─────────────────────────────────────────── */
function InlineForm({ children, onSubmit, saving, label }) {
    return (
        <form onSubmit={onSubmit} className="p-4 bg-stone-50 dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">{children}</div>
            <button
                type="submit" disabled={saving}
                className="btn-primary text-sm py-2"
                style={{ borderRadius: '8px' }}
            >
                {saving ? 'Guardando...' : label}
            </button>
        </form>
    );
}

/* ── Compras Tab ────────────────────────────────────────── */
function ComprasTab({ viajeId, readOnly }) {
    const [items,     setItems]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [showForm,  setShowForm]  = useState(false);
    const [saving,    setSaving]    = useState(false);
    const [form, setForm] = useState({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });

    const load = useCallback(async () => {
        const { data } = await supabase.from('compras').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('compras').insert({
            viaje_id: viajeId, producto: form.producto,
            cantidad: Number(form.cantidad), unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha, notas: form.notas || null,
        });
        setForm({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function del(id) { await supabase.from('compras').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="card p-0 overflow-hidden">
            <SectionHeader count={items.length} total={total} color="text-orange-600">
                {!readOnly && <AddButton onClick={() => setShowForm(s => !s)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleAdd} saving={saving} label="Guardar compra">
                    <input required placeholder="Producto" value={form.producto} onChange={sf('producto')} className="input-base col-span-2" />
                    <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={sf('cantidad')} className="input-base" />
                    <select value={form.unidad} onChange={sf('unidad')} className="input-base">
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base col-span-2" />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            {loading ? <Spinner />
                : items.length === 0 ? <EmptyState msg="Sin compras registradas. Agrega la primera." />
                : items.map(i => (
                    <ItemRow key={i.id}
                        title={i.producto}
                        line={`${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                        date={fmtDate(i.fecha)}
                        note={i.notas}
                        onDelete={!readOnly ? () => del(i.id) : null}
                    />
                ))
            }
        </div>
    );
}

/* ── Ventas Tab ─────────────────────────────────────────── */
function VentasTab({ viajeId, readOnly }) {
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [form, setForm] = useState({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });

    const load = useCallback(async () => {
        const { data } = await supabase.from('ventas').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('ventas').insert({
            viaje_id: viajeId, producto: form.producto,
            cantidad: Number(form.cantidad), unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha, notas: form.notas || null,
        });
        setForm({ producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function del(id) { await supabase.from('ventas').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="card p-0 overflow-hidden">
            <SectionHeader count={items.length} total={total} color="text-blue-600">
                {!readOnly && <AddButton onClick={() => setShowForm(s => !s)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleAdd} saving={saving} label="Guardar venta">
                    <input required placeholder="Producto" value={form.producto} onChange={sf('producto')} className="input-base col-span-2" />
                    <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={sf('cantidad')} className="input-base" />
                    <select value={form.unidad} onChange={sf('unidad')} className="input-base">
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base col-span-2" />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            {loading ? <Spinner />
                : items.length === 0 ? <EmptyState msg="Sin ventas registradas. Agrega la primera." />
                : items.map(i => (
                    <ItemRow key={i.id}
                        title={i.producto}
                        line={`${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                        date={fmtDate(i.fecha)}
                        note={i.notas}
                        onDelete={!readOnly ? () => del(i.id) : null}
                    />
                ))
            }
        </div>
    );
}

/* ── Costos Tab ─────────────────────────────────────────── */
function CostosTab({ viajeId, readOnly }) {
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [form, setForm] = useState({ tipo: 'obreros', descripcion: '', monto: '', fecha: today() });

    const load = useCallback(async () => {
        const { data } = await supabase.from('costos_adicionales').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

    async function handleAdd(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('costos_adicionales').insert({
            viaje_id: viajeId, tipo: form.tipo,
            descripcion: form.descripcion, monto: Number(form.monto), fecha: form.fecha,
        });
        setForm({ tipo: 'obreros', descripcion: '', monto: '', fecha: today() });
        setShowForm(false);
        setSaving(false);
        load();
    }

    async function del(id) { await supabase.from('costos_adicionales').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.monto), 0);

    return (
        <div className="card p-0 overflow-hidden">
            <SectionHeader count={items.length} total={total} color="text-blue-600">
                {!readOnly && <AddButton onClick={() => setShowForm(s => !s)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleAdd} saving={saving} label="Guardar costo">
                    <select value={form.tipo} onChange={sf('tipo')} className="input-base">
                        {TIPOS_COSTO.map(t => (
                            <option key={t} value={t}>{TIPO_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input required placeholder="Descripción" value={form.descripcion} onChange={sf('descripcion')} className="input-base col-span-2" />
                    <input required type="number" step="0.01" min="0" placeholder="Monto ($)" value={form.monto} onChange={sf('monto')} className="input-base col-span-2" />
                </InlineForm>
            )}

            {loading ? <Spinner />
                : items.length === 0 ? <EmptyState msg="Sin costos adicionales. Agrega el primero." />
                : items.map(i => (
                    <ItemRow key={i.id}
                        title={`${TIPO_ICON[i.tipo] ?? '📌'} ${i.descripcion}`}
                        line={`${i.tipo} · $${fmt(i.monto)}`}
                        date={fmtDate(i.fecha)}
                        onDelete={!readOnly ? () => del(i.id) : null}
                    />
                ))
            }
        </div>
    );
}

/* ── Resumen Tab ────────────────────────────────────────── */
function ResumenTab({ viajeId }) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [cR, vR, kR] = await Promise.all([
                supabase.from('compras').select('cantidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('ventas').select('cantidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('costos_adicionales').select('monto').eq('viaje_id', viajeId),
            ]);
            const totalCompras = (cR.data ?? []).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalVentas  = (vR.data ?? []).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalCostos  = (kR.data ?? []).reduce((s, i) => s + Number(i.monto), 0);
            setData({ totalCompras, totalVentas, totalCostos });
            setLoading(false);
        }
        load();
    }, [viajeId]);

    if (loading) return <Spinner />;

    const { totalCompras, totalVentas, totalCostos } = data;
    const bruta = totalVentas - totalCompras;
    const neta  = bruta - totalCostos;

    const noData = totalVentas === 0 && totalCompras === 0 && totalCostos === 0;

    return (
        <div className="space-y-3 animate-fade-in">

            {/* Tres totales */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Ventas',  value: totalVentas,  color: 'text-blue-600',   border: 'border-blue-200',   bg: 'bg-blue-50'   },
                    { label: 'Compras', value: totalCompras, color: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50' },
                    { label: 'Costos',  value: totalCostos,  color: 'text-blue-600',   border: 'border-blue-200',   bg: 'bg-blue-50'   },
                ].map(s => (
                    <div key={s.label} className={`card py-3 px-3 border ${s.border} ${s.bg}`}>
                        <p className="text-xs text-stone-500 mb-1">{s.label}</p>
                        <p className={`text-base font-semibold tabular ${s.color}`}>${fmt(s.value)}</p>
                    </div>
                ))}
            </div>

            {/* Cálculo */}
            <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Cálculo de ganancia</p>
                </div>
                <div className="divide-y divide-stone-100 dark:divide-slate-700">
                    <Row label="Ingresos por ventas"  value={`+ $${fmt(totalVentas)}`}  color="text-blue-600" />
                    <Row label="Costo de compras"      value={`− $${fmt(totalCompras)}`} color="text-orange-600" />
                    <Row label="Ganancia bruta" bold
                        value={(bruta >= 0 ? '+ ' : '') + `$${fmt(bruta)}`}
                        color={bruta >= 0 ? 'text-blue-600' : 'text-red-600'} />
                    <Row label="Costos adicionales"   value={`− $${fmt(totalCostos)}`}  color="text-blue-600" />
                    <div className="px-4 py-4 bg-stone-50 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-stone-900 dark:text-slate-100">Ganancia neta</p>
                            <p className={`text-xl font-bold tabular ${neta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {neta >= 0 ? '+' : ''}${fmt(neta)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {noData && (
                <div className="card border-dashed text-center py-8">
                    <p className="text-sm text-stone-400 text-balance">
                        Agrega compras, ventas y costos para ver el resumen del viaje.
                    </p>
                </div>
            )}
            {!noData && neta < 0 && (
                <div className="card border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
                    <p className="text-sm text-red-700 dark:text-red-400">
                        Pérdida de <span className="font-semibold tabular">${fmt(Math.abs(neta))}</span>. Los costos totales superan los ingresos.
                    </p>
                </div>
            )}
            {!noData && neta >= 0 && (
                <div className="card border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        Ganancia neta: <span className="font-semibold tabular">${fmt(neta)}</span>
                    </p>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, color, bold }) {
    return (
        <div className="flex items-center justify-between px-4 py-3">
            <p className={`text-sm ${bold ? 'font-semibold text-stone-800 dark:text-slate-200' : 'text-stone-600 dark:text-slate-400'}`}>{label}</p>
            <p className={`text-sm font-semibold tabular ${color}`}>{value}</p>
        </div>
    );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function ViajeDetallePage() {
    const { id }  = useParams();
    const router  = useRouter();
    const [viaje,      setViaje]      = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [activeTab,  setActiveTab]  = useState('compras');
    const [closing,    setClosing]    = useState(false);

    useEffect(() => {
        supabase.from('viajes').select('*').eq('id', id).single()
            .then(({ data }) => { setViaje(data); setLoading(false); });
    }, [id]);

    async function handleCerrar() {
        if (!confirm('¿Cerrar este viaje? No podrás agregar más registros.')) return;
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
                <div className="w-7 h-7 rounded-full border-[3px] border-stone-200 border-t-blue-600 animate-spin" />
            </div>
        );
    }

    if (!viaje) {
        return (
            <div className="text-center py-20">
                <p className="text-stone-400 text-sm">Viaje no encontrado.</p>
                <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-blue-600 hover:underline">
                    Volver
                </button>
            </div>
        );
    }

    const isClosed = viaje.estado === 'cerrado';

    return (
        <div className="animate-fade-in space-y-5">

            {/* Header */}
            <div>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-xs text-stone-400 dark:text-slate-500 hover:text-stone-700 dark:hover:text-slate-300 transition-colors mb-3 flex items-center gap-1"
                >
                    ← Mis viajes
                </button>

                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-lg font-semibold text-stone-900 dark:text-slate-100">{viaje.nombre}</h1>
                            <span className={`badge text-xs ${isClosed ? 'badge-gray' : 'badge-blue'}`}>
                                {isClosed ? 'Cerrado' : 'Activo'}
                            </span>
                        </div>
                        {viaje.descripcion && (
                            <p className="text-sm text-stone-500 dark:text-slate-400 mt-1">{viaje.descripcion}</p>
                        )}
                        <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
                            Inicio: {fmtDate(viaje.fecha_inicio)}
                            {viaje.fecha_fin && ` · Fin: ${fmtDate(viaje.fecha_fin)}`}
                        </p>
                    </div>

                    {!isClosed && (
                        <button
                            onClick={handleCerrar}
                            disabled={closing}
                            className="shrink-0 text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 hover:border-red-200 transition-colors disabled:opacity-50"
                        >
                            {closing ? '...' : 'Cerrar viaje'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs — underline style */}
            <div className="flex border-b border-stone-200 dark:border-slate-700 gap-0">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200 hover:border-stone-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'compras' && <ComprasTab viajeId={id} readOnly={isClosed} />}
            {activeTab === 'ventas'  && <VentasTab  viajeId={id} readOnly={isClosed} />}
            {activeTab === 'costos'  && <CostosTab  viajeId={id} readOnly={isClosed} />}
            {activeTab === 'resumen' && <ResumenTab viajeId={id} />}
        </div>
    );
}
