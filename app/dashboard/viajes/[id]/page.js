'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, X, Pencil, ClipboardList, HardHat, Utensils, BedDouble, Fuel, Droplet, Truck, Tag } from 'lucide-react';
import { FASES, FASE_META, faseIndex, avanceConfig } from '@/lib/viajeFases.mjs';
import supabase from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const UNIDADES    = ['kg', 'caja', 'unidad', 'saco', 'paca', 'otro'];
const TIPOS_COSTO = ['administracion', 'obreros', 'comida', 'hotel', 'gasolina', 'gasoil', 'transporte', 'otro'];
const TIPO_ICON   = { administracion: ClipboardList, obreros: HardHat, comida: Utensils, hotel: BedDouble, gasolina: Fuel, gasoil: Droplet, transporte: Truck, otro: Tag };
const TIPO_LABEL  = t => t.charAt(0).toUpperCase() + t.slice(1);

function fmt(n) {
    return Number(n ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); }

/* ── Shared primitives ──────────────────────────────────── */

function Spinner() {
    return (
        <div className="py-10 flex justify-center">
            <div className="w-6 h-6 rounded-full border-[3px] border-stone-200 border-t-foreground animate-spin" />
        </div>
    );
}

function EmptyState({ msg }) {
    return <p className="py-6 text-center text-sm text-stone-400 dark:text-slate-500">{msg}</p>;
}

function DeleteBtn({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
        >
            <X className="w-4 h-4" />
        </button>
    );
}

function EditBtn({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-stone-300 hover:text-foreground hover:bg-muted transition-colors"
            title="Editar"
        >
            <Pencil className="w-3.5 h-3.5" />
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
                    : 'border-foreground/30 text-foreground hover:bg-muted'
            }`}
        >
            {open ? 'Cancelar' : '+ Agregar'}
        </button>
    );
}

/* ── Item row ───────────────────────────────────────────── */
function ItemRow({ title, line, date, note, onEdit, onDelete }) {
    return (
        <div className="card py-3 px-4 flex items-center gap-3 group hover:border-ring transition-colors">
            <p className="text-sm font-medium text-stone-800 dark:text-slate-200 flex-1 min-w-0 truncate">{title}</p>
            <div className="text-right shrink-0">
                <p className="text-xs text-stone-600 dark:text-slate-300 tabular">{line}</p>
                <p className="text-xs text-stone-400 dark:text-slate-500 mt-0.5">{date}{note ? ` · ${note}` : ''}</p>
            </div>
            {(onEdit || onDelete) && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onEdit && <EditBtn onClick={onEdit} />}
                    {onDelete && <DeleteBtn onClick={onDelete} />}
                </div>
            )}
        </div>
    );
}

/* ── Section total badge ─────────────────────────────────── */
function SectionHeader({ titulo, count, total, color, children }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2.5 min-w-0">
                <h2 className="text-sm font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider shrink-0">{titulo}</h2>
                <span className="text-xs text-stone-400 dark:text-slate-500 whitespace-nowrap">{count} registro{count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-semibold tabular ${color}`}>${fmt(total)}</span>
                {children}
            </div>
        </div>
    );
}

/* ── Catálogo de productos (compartido por Compras/Ventas) ─ */
function useProductos() {
    const { user } = useAuth();
    const [productos, setProductos] = useState([]);

    const load = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre');
        setProductos(data ?? []);
    }, [user]);

    useEffect(() => { load(); }, [load]);

    return { productos, reload: load, userId: user?.id };
}

/* ── Select de producto, con opción de crear uno nuevo ────── */
function ProductoField({ value, onChange, productos, onCreated, userId }) {
    const [creating, setCreating] = useState(false);
    const [newName,  setNewName]  = useState('');
    const [error,    setError]    = useState('');

    async function handleCreate() {
        const nombre = newName.trim();
        if (!nombre) return;
        const { data, error: dbErr } = await supabase
            .from('productos').insert({ user_id: userId, nombre }).select().single();
        if (dbErr) return setError('Ya existe un item con ese nombre.');
        onCreated(data);
        onChange(data.nombre);
        setNewName('');
        setError('');
        setCreating(false);
    }

    if (creating) {
        return (
            <div className="col-span-2 flex gap-2">
                <input
                    autoFocus placeholder="Nombre del nuevo item"
                    value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                    className="input-base flex-1"
                />
                <button type="button" onClick={handleCreate} className="btn-secondary text-sm px-3 shrink-0" style={{ width: 'auto' }}>
                    Crear
                </button>
                <button type="button" onClick={() => { setCreating(false); setError(''); }} className="text-stone-400 hover:text-stone-600 shrink-0 px-1 flex items-center">
                    <X className="w-4 h-4" />
                </button>
                {error && <p className="text-xs text-red-500 col-span-2">{error}</p>}
            </div>
        );
    }

    return (
        <select
            required value={value}
            onChange={e => e.target.value === '__nuevo__' ? setCreating(true) : onChange(e.target.value)}
            className="input-base col-span-2"
        >
            <option value="" disabled>Selecciona un producto...</option>
            {productos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            <option value="__nuevo__">+ Crear nuevo item...</option>
        </select>
    );
}

/* ── Inline form ─────────────────────────────────────────── */
function InlineForm({ children, onSubmit, saving, label }) {
    return (
        <form onSubmit={onSubmit} className="card bg-stone-50 dark:bg-slate-800 space-y-3">
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
function ComprasTab({ viajeId, readOnly, titulo }) {
    const [items,     setItems]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [showForm,  setShowForm]  = useState(false);
    const [saving,    setSaving]    = useState(false);
    const [editId,    setEditId]    = useState(null);
    const EMPTY = { producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' };
    const [form, setForm] = useState(EMPTY);
    const { productos, reload: reloadProductos, userId } = useProductos();

    const load = useCallback(async () => {
        const { data } = await supabase.from('compras').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm(EMPTY); setEditId(null); setShowForm(false); }
    function startEdit(i) {
        setForm({ producto: i.producto, cantidad: String(i.cantidad), unidad: i.unidad, precio_unitario: String(i.precio_unitario), fecha: i.fecha, notas: i.notas ?? '' });
        setEditId(i.id);
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            viaje_id: viajeId, producto: form.producto,
            cantidad: Number(form.cantidad), unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha, notas: form.notas || null,
        };
        if (editId) await supabase.from('compras').update(payload).eq('id', editId);
        else        await supabase.from('compras').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('compras').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : setShowForm(true)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleSubmit} saving={saving} label={editId ? 'Guardar cambios' : 'Guardar compra'}>
                    <ProductoField
                        value={form.producto}
                        onChange={v => setForm(f => ({ ...f, producto: v }))}
                        productos={productos} userId={userId}
                        onCreated={() => reloadProductos()}
                    />
                    <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={sf('cantidad')} className="input-base" />
                    <select value={form.unidad} onChange={sf('unidad')} className="input-base">
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base col-span-2" />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin compras registradas. Agrega la primera." />
                    : items.map(i => (
                        <ItemRow key={i.id}
                            title={i.producto}
                            line={`${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                            date={fmtDate(i.fecha)}
                            note={i.notas}
                            onEdit={!readOnly ? () => startEdit(i) : null}
                            onDelete={!readOnly ? () => del(i.id) : null}
                        />
                    ))
                }
            </div>
        </div>
    );
}

/* ── Ventas Tab ─────────────────────────────────────────── */
function VentasTab({ viajeId, readOnly, titulo }) {
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const EMPTY = { producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', fecha: today(), notas: '' };
    const [form, setForm] = useState(EMPTY);
    const { productos, reload: reloadProductos, userId } = useProductos();

    const load = useCallback(async () => {
        const { data } = await supabase.from('ventas').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm(EMPTY); setEditId(null); setShowForm(false); }
    function startEdit(i) {
        setForm({ producto: i.producto, cantidad: String(i.cantidad), unidad: i.unidad, precio_unitario: String(i.precio_unitario), fecha: i.fecha, notas: i.notas ?? '' });
        setEditId(i.id);
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            viaje_id: viajeId, producto: form.producto,
            cantidad: Number(form.cantidad), unidad: form.unidad,
            precio_unitario: Number(form.precio_unitario),
            fecha: form.fecha, notas: form.notas || null,
        };
        if (editId) await supabase.from('ventas').update(payload).eq('id', editId);
        else        await supabase.from('ventas').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('ventas').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : setShowForm(true)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleSubmit} saving={saving} label={editId ? 'Guardar cambios' : 'Guardar venta'}>
                    <ProductoField
                        value={form.producto}
                        onChange={v => setForm(f => ({ ...f, producto: v }))}
                        productos={productos} userId={userId}
                        onCreated={() => reloadProductos()}
                    />
                    <input required type="number" step="0.01" min="0.01" placeholder="Cantidad" value={form.cantidad} onChange={sf('cantidad')} className="input-base" />
                    <select value={form.unidad} onChange={sf('unidad')} className="input-base">
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input required type="number" step="0.01" min="0" placeholder="Precio por unidad ($)" value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base col-span-2" />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin ventas registradas. Agrega la primera." />
                    : items.map(i => (
                        <ItemRow key={i.id}
                            title={i.producto}
                            line={`${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(Number(i.cantidad) * Number(i.precio_unitario))}`}
                            date={fmtDate(i.fecha)}
                            note={i.notas}
                            onEdit={!readOnly ? () => startEdit(i) : null}
                            onDelete={!readOnly ? () => del(i.id) : null}
                        />
                    ))
                }
            </div>
        </div>
    );
}

/* ── Costos Tab ─────────────────────────────────────────── */
function CostosTab({ viajeId, readOnly, titulo }) {
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const EMPTY = { tipo: 'obreros', descripcion: '', monto: '', fecha: today() };
    const [form, setForm] = useState(EMPTY);

    const load = useCallback(async () => {
        const { data } = await supabase.from('costos_adicionales').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm(EMPTY); setEditId(null); setShowForm(false); }
    function startEdit(i) {
        setForm({ tipo: i.tipo, descripcion: i.descripcion, monto: String(i.monto), fecha: i.fecha });
        setEditId(i.id);
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            viaje_id: viajeId, tipo: form.tipo,
            descripcion: form.descripcion, monto: Number(form.monto), fecha: form.fecha,
        };
        if (editId) await supabase.from('costos_adicionales').update(payload).eq('id', editId);
        else        await supabase.from('costos_adicionales').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('costos_adicionales').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + Number(i.monto), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : setShowForm(true)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleSubmit} saving={saving} label={editId ? 'Guardar cambios' : 'Guardar costo'}>
                    <select value={form.tipo} onChange={sf('tipo')} className="input-base">
                        {TIPOS_COSTO.map(t => (
                            <option key={t} value={t}>{TIPO_LABEL(t)}</option>
                        ))}
                    </select>
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input required placeholder="Descripción" value={form.descripcion} onChange={sf('descripcion')} className="input-base col-span-2" />
                    <input required type="number" step="0.01" min="0" placeholder="Monto ($)" value={form.monto} onChange={sf('monto')} className="input-base col-span-2" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin costos adicionales. Agrega el primero." />
                    : items.map(i => {
                        const Icon = TIPO_ICON[i.tipo] ?? Tag;
                        return (
                        <ItemRow key={i.id}
                            title={<span className="inline-flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {i.descripcion}</span>}
                            line={`${TIPO_LABEL(i.tipo)} · $${fmt(i.monto)}`}
                            date={fmtDate(i.fecha)}
                            onEdit={!readOnly ? () => startEdit(i) : null}
                            onDelete={!readOnly ? () => del(i.id) : null}
                        />
                        );
                    })
                }
            </div>
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
                supabase.from('compras').select('producto,cantidad,unidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('ventas').select('producto,cantidad,unidad,precio_unitario').eq('viaje_id', viajeId),
                supabase.from('costos_adicionales').select('monto').eq('viaje_id', viajeId),
            ]);
            const compras = cR.data ?? [], ventas = vR.data ?? [];
            const totalCompras = compras.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalVentas  = ventas.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
            const totalCostos  = (kR.data ?? []).reduce((s, i) => s + Number(i.monto), 0);

            // Sobrante por producto: comprado vs vendido (por nombre de producto)
            const prod = {};
            const ensure = (nombre, unidad) => (prod[nombre] ??= { nombre, unidad, comprado: 0, vendido: 0 });
            compras.forEach(i => { ensure(i.producto, i.unidad).comprado += Number(i.cantidad); });
            ventas.forEach(i  => { const p = ensure(i.producto, i.unidad); p.vendido += Number(i.cantidad); if (!p.unidad) p.unidad = i.unidad; });
            const sobrantes = Object.values(prod).sort((a, b) => a.nombre.localeCompare(b.nombre));

            setData({ totalCompras, totalVentas, totalCostos, sobrantes });
            setLoading(false);
        }
        load();
    }, [viajeId]);

    if (loading) return <Spinner />;

    const { totalCompras, totalVentas, totalCostos, sobrantes } = data;
    const bruta = totalVentas - totalCompras;
    const neta  = bruta - totalCostos;

    const noData = totalVentas === 0 && totalCompras === 0 && totalCostos === 0;

    return (
        <div className="space-y-3 animate-fade-in">

            {/* Tres totales */}
            <div className="grid grid-cols-3 gap-3">
                <div className="stat-tile stat-green">
                    <p className="stat-label">Ventas</p>
                    <p className="stat-value">${fmt(totalVentas)}</p>
                </div>
                <div className="stat-tile stat-orange">
                    <p className="stat-label">Compras</p>
                    <p className="stat-value">${fmt(totalCompras)}</p>
                </div>
                <div className="stat-tile stat-amber">
                    <p className="stat-label">Costos</p>
                    <p className="stat-value">${fmt(totalCostos)}</p>
                </div>
            </div>

            {/* Cálculo */}
            <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Cálculo de ganancia</p>
                </div>
                <div className="divide-y divide-stone-100 dark:divide-slate-700">
                    <Row label="Ingresos por ventas"  value={`+ $${fmt(totalVentas)}`}  color="text-foreground" />
                    <Row label="Costo de compras"      value={`− $${fmt(totalCompras)}`} color="text-foreground" />
                    <Row label="Ganancia bruta" bold
                        value={(bruta >= 0 ? '+ ' : '− ') + `$${fmt(Math.abs(bruta))}`}
                        color={bruta >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'} />
                    <Row label="Costos adicionales"   value={`− $${fmt(totalCostos)}`}  color="text-foreground" />
                    <div className="px-4 py-4 bg-stone-50 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-stone-900 dark:text-slate-100">Ganancia neta</p>
                            <p className={`text-xl font-bold tabular ${neta >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'}`}>
                                {neta >= 0 ? '+' : '−'}${fmt(Math.abs(neta))}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sobrante por producto */}
            {sobrantes.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100 dark:border-slate-700">
                        <p className="text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Sobrante por producto</p>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs">
                        <div className="contents text-stone-400 dark:text-slate-500 font-medium">
                            <span className="px-4 py-2">Producto</span>
                            <span className="px-2 py-2 text-right tabular">Comprado</span>
                            <span className="px-2 py-2 text-right tabular">Vendido</span>
                            <span className="px-4 py-2 text-right tabular">Sobrante</span>
                        </div>
                        {sobrantes.map(p => {
                            const sob = p.comprado - p.vendido;
                            const faltante = sob < 0;
                            return (
                                <div key={p.nombre} className="contents group">
                                    <span className="px-4 py-2.5 text-sm text-stone-800 dark:text-slate-200 border-t border-stone-100 dark:border-slate-700 truncate">{p.nombre}</span>
                                    <span className="px-2 py-2.5 text-sm text-stone-500 dark:text-slate-400 text-right tabular border-t border-stone-100 dark:border-slate-700">{fmt(p.comprado)}</span>
                                    <span className="px-2 py-2.5 text-sm text-stone-500 dark:text-slate-400 text-right tabular border-t border-stone-100 dark:border-slate-700">{fmt(p.vendido)}</span>
                                    <span className={`px-4 py-2.5 text-sm font-medium text-right tabular border-t border-stone-100 dark:border-slate-700 ${faltante ? 'text-red-600 dark:text-red-400' : sob > 0 ? 'text-foreground' : 'text-foreground'}`}>
                                        {fmt(sob)} <span className="text-stone-400 dark:text-slate-500 font-normal">{p.unidad}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="px-4 py-2.5 text-xs text-stone-400 dark:text-slate-500 border-t border-stone-100 dark:border-slate-700">
                        Sobrante positivo = mercancía sin vender · negativo = se vendió más de lo comprado
                    </p>
                </div>
            )}

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
                <div className="card border-border bg-muted">
                    <p className="text-sm text-foreground">
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

/* ── Panel de divisas del viaje ──────────────────────────── */
function DivisasPanel({ viajeId, readOnly, onChange }) {
    const [divisas, setDivisas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding,  setAdding]  = useState(false);
    const [nueva,   setNueva]   = useState({ codigo: '', tasa: '' });
    const [editId,  setEditId]  = useState(null);
    const [editVal, setEditVal] = useState({ codigo: '', tasa: '' });

    const load = useCallback(async () => {
        const { data } = await supabase.from('viaje_divisas').select('*')
            .eq('viaje_id', viajeId)
            .order('es_base', { ascending: false }).order('codigo');
        setDivisas(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    async function addDivisa(e) {
        e.preventDefault();
        const codigo = nueva.codigo.trim();
        const tasa = Number(nueva.tasa);
        if (!codigo || !(tasa > 0)) return;
        await supabase.from('viaje_divisas').insert({ viaje_id: viajeId, codigo, tasa, es_base: false });
        setNueva({ codigo: '', tasa: '' });
        setAdding(false);
        load();
        onChange?.();
    }

    function startEdit(d) { setEditId(d.id); setEditVal({ codigo: d.codigo, tasa: String(d.tasa) }); }

    async function saveEdit() {
        const codigo = editVal.codigo.trim();
        const tasa = Number(editVal.tasa);
        if (!codigo || !(tasa > 0)) return;
        await supabase.from('viaje_divisas').update({ codigo, tasa }).eq('id', editId);
        setEditId(null);
        load();
        onChange?.();
    }

    async function del(d) {
        if (d.es_base) return;
        if (!confirm(`¿Borrar la divisa ${d.codigo}? Las compras en ${d.codigo} pasarán a USD con su valor convertido.`)) return;
        const base = divisas.find(x => x.es_base);
        const { data: compras } = await supabase.from('compras').select('id,precio_unitario').eq('divisa_id', d.id);
        for (const c of compras ?? []) {
            await supabase.from('compras').update({
                precio_unitario: Number(c.precio_unitario) / Number(d.tasa),
                divisa_id: base.id,
            }).eq('id', c.id);
        }
        await supabase.from('viaje_divisas').delete().eq('id', d.id);
        load();
        onChange?.();
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
                <h2 className="text-sm font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Divisas del viaje</h2>
                {!readOnly && <AddButton onClick={() => setAdding(a => !a)} open={adding} />}
            </div>

            {adding && (
                <form onSubmit={addDivisa} className="card bg-stone-50 dark:bg-slate-800 flex gap-2 mb-2.5">
                    <input placeholder="Código (ej. COP)" value={nueva.codigo} onChange={e => setNueva(n => ({ ...n, codigo: e.target.value }))} className="input-base flex-1" />
                    <input type="number" step="0.0001" min="0" placeholder="1 USD = ?" value={nueva.tasa} onChange={e => setNueva(n => ({ ...n, tasa: e.target.value }))} className="input-base flex-1" />
                    <button type="submit" className="btn-secondary text-sm px-3 shrink-0" style={{ width: 'auto' }}>Agregar</button>
                </form>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2">
                {loading ? <Spinner />
                    : divisas.map(d => (
                        <div key={d.id} className="card py-2.5 px-4 flex items-center gap-3">
                            {editId === d.id ? (
                                <>
                                    <span className="text-xs text-stone-400 dark:text-slate-500 shrink-0">1 USD =</span>
                                    <input type="number" step="0.0001" min="0" value={editVal.tasa} onChange={e => setEditVal(v => ({ ...v, tasa: e.target.value }))} className="input-base w-28" />
                                    <input value={editVal.codigo} onChange={e => setEditVal(v => ({ ...v, codigo: e.target.value }))} className="input-base w-24" />
                                    <div className="flex-1" />
                                    <button onClick={saveEdit} className="btn-secondary text-sm px-3 shrink-0" style={{ width: 'auto' }}>Guardar</button>
                                    <button onClick={() => setEditId(null)} className="text-stone-400 hover:text-stone-600 px-1 shrink-0 flex items-center"><X className="w-4 h-4" /></button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-stone-800 dark:text-slate-200 flex-1">
                                        1 USD = <span className="tabular">{fmt(d.tasa)}</span> {d.codigo}
                                        {d.es_base && <span className="text-xs text-stone-400 dark:text-slate-500 ml-2 font-normal">(base)</span>}
                                    </p>
                                    {!readOnly && !d.es_base && (
                                        <div className="flex items-center shrink-0">
                                            <EditBtn onClick={() => startEdit(d)} />
                                            <DeleteBtn onClick={() => del(d)} />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))
                }
            </div>
        </div>
    );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function ViajeDetallePage() {
    const { id }  = useParams();
    const router  = useRouter();
    const [viaje,     setViaje]     = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [advancing, setAdvancing] = useState(false);
    const [closing,   setClosing]   = useState(false);
    const [divisasVersion, setDivisasVersion] = useState(0);

    useEffect(() => {
        supabase.from('viajes').select('*').eq('id', id).single()
            .then(({ data }) => { setViaje(data); setLoading(false); });
    }, [id]);

    async function handleAvanzar() {
        const cfg = avanceConfig(viaje.fase);
        if (!cfg) return;
        if (!confirm(cfg.confirm)) return;
        setAdvancing(true);
        await supabase.from('viajes').update({ fase: cfg.next }).eq('id', id);
        setViaje(v => ({ ...v, fase: cfg.next }));
        setAdvancing(false);
    }

    async function handleCerrar() {
        if (!confirm('¿Cerrar este viaje? No podrás agregar más registros.')) return;
        setClosing(true);
        const fecha_fin = today();
        await supabase.from('viajes').update({ estado: 'cerrado', fecha_fin }).eq('id', id);
        setViaje(v => ({ ...v, estado: 'cerrado', fecha_fin }));
        setClosing(false);
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="w-7 h-7 rounded-full border-[3px] border-stone-200 border-t-foreground animate-spin" />
            </div>
        );
    }

    if (!viaje) {
        return (
            <div className="text-center py-20">
                <p className="text-stone-400 text-sm">Viaje no encontrado.</p>
                <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-foreground hover:underline">
                    Volver
                </button>
            </div>
        );
    }

    const isClosed = viaje.estado === 'cerrado';
    const vista    = isClosed ? 'resumen' : viaje.fase;
    const cfg      = avanceConfig(viaje.fase);
    const pasoNum  = faseIndex(viaje.fase) + 1;

    return (
        <div className="animate-fade-in space-y-5">

            {/* Header */}
            <div>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-xs text-stone-400 dark:text-slate-500 hover:text-stone-700 dark:hover:text-slate-300 transition-colors mb-3 flex items-center gap-1"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Mis viajes
                </button>

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

            {/* Indicador de fase (una a la vez) */}
            {!isClosed && (
                <div className="flex items-center gap-2 text-sm border-b border-stone-200 dark:border-slate-700 pb-3">
                    <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs flex items-center justify-center shrink-0">{pasoNum}</span>
                    <span className="font-medium text-foreground">{FASE_META[viaje.fase].label}</span>
                    <span className="text-xs text-stone-400 dark:text-slate-500">Paso {pasoNum} de {FASES.length}</span>
                </div>
            )}

            {/* Contenido de la fase actual */}
            {vista === 'preparacion' && (
                <div className="space-y-6">
                    <DivisasPanel viajeId={id} readOnly={isClosed} onChange={() => setDivisasVersion(v => v + 1)} />
                    <ComprasTab viajeId={id} readOnly={isClosed} titulo="Compras" divisasVersion={divisasVersion} />
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" />
                </div>
            )}
            {vista === 'en_curso' && <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" />}
            {vista === 'ventas'   && <VentasTab viajeId={id} readOnly={isClosed} titulo="Ventas" />}
            {vista === 'resumen'  && <ResumenTab viajeId={id} />}

            {/* Acción de avance / cierre */}
            {!isClosed && cfg && (
                <button onClick={handleAvanzar} disabled={advancing} className="btn-primary">
                    {advancing ? 'Guardando...' : cfg.label}
                </button>
            )}
            {!isClosed && viaje.fase === 'ventas' && (
                <button onClick={handleCerrar} disabled={closing} className="btn-primary">
                    {closing ? 'Cerrando...' : 'Cerrar viaje'}
                </button>
            )}
        </div>
    );
}
