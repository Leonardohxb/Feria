'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, X, Pencil, ClipboardList, HardHat, Utensils, BedDouble, Fuel, Droplet, Truck, Tag } from 'lucide-react';
import { FASES, FASE_META, faseIndex, avanceConfig } from '@/lib/viajeFases.mjs';
import { montoUsd, costoFinalPorKg, ventaTotal } from '@/lib/divisas.mjs';
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

/* ── Materiales comprados en el viaje (para Ventas) ────────
   Carga los productos de las compras del viaje (agregados por
   nombre) con cantidad y costo total estimado (compra + traslado
   proporcional para kg) para mostrarlos al vender. */
function useMaterialesViaje(viajeId, tasaTraslado) {
    const { user } = useAuth();
    const [materiales, setMateriales] = useState([]);

    const load = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase.from('compras')
            .select('producto,unidad,cantidad,precio_unitario, viaje_divisas(tasa)')
            .eq('viaje_id', viajeId);
        const map = new Map();
        (data ?? []).forEach(c => {
            if (!c.producto) return;
            const precioUsd = montoUsd(1, c.precio_unitario, c.viaje_divisas?.tasa ?? 1);
            const costoUsd = Number(c.cantidad) * precioUsd;
            const existing = map.get(c.producto);
            if (existing && existing.unidad === c.unidad) {
                existing.cantidad += Number(c.cantidad);
                existing.costoCompras += costoUsd;
            } else if (!existing) {
                map.set(c.producto, {
                    nombre: c.producto,
                    unidad: c.unidad,
                    cantidad: Number(c.cantidad),
                    costoCompras: costoUsd,
                    activo: true,
                });
            }
        });
        const tasa = Number(tasaTraslado) || 0;
        const lista = [...map.values()].map(m => {
            const traslado = m.unidad === 'kg' ? m.cantidad * tasa : 0;
            const costoTotal = m.costoCompras + traslado;
            return {
                ...m,
                costoEstimado: costoTotal,
                costoCompras: m.costoCompras,
                traslado,
                label: `${m.nombre} (${Number(m.cantidad)} ${m.unidad})`,
            };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
        setMateriales(lista);
    }, [user, viajeId, tasaTraslado]);

    useEffect(() => { load(); }, [load]);

    return { materiales, reload: load, userId: user?.id };
}

/* ── Select de producto, con opción de crear uno nuevo ────── */
function ProductoField({ value, onChange, productos, onCreated, userId, permitirCrear = true }) {
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
            {productos.map(p => <option key={p.id ?? p.nombre} value={p.nombre}>{p.label ?? p.nombre}</option>)}
            {permitirCrear && <option value="__nuevo__">+ Crear nuevo item...</option>}
        </select>
    );
}

/* ── Catálogo de tipos de costo (custom del usuario) ─────── */
function useCostoTipos() {
    const { user } = useAuth();
    const [tipos, setTipos] = useState([]);

    const load = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase.from('costo_tipos').select('*').eq('activo', true).order('nombre');
        setTipos(data ?? []);
    }, [user]);

    useEffect(() => { load(); }, [load]);

    return { tipos, reload: load, userId: user?.id };
}

/* ── Select de tipo de costo, con opción de crear uno nuevo ─
   Combina los predeterminados (hardcodeados) + los custom del
   usuario, sin duplicar por nombre. */
function TipoCostoField({ value, onChange, tipos, onCreated, userId }) {
    const [creating, setCreating] = useState(false);
    const [newName,  setNewName]  = useState('');
    const [error,    setError]    = useState('');

    // Custom que no chocan con los predeterminados
    const customUnicos = tipos
        .map(t => t.nombre)
        .filter(n => !TIPOS_COSTO.includes(n));
    const opciones = [...TIPOS_COSTO, ...customUnicos];

    async function handleCreate() {
        const nombre = newName.trim();
        if (!nombre) return;
        const { data, error: dbErr } = await supabase
            .from('costo_tipos').insert({ user_id: userId, nombre }).select().single();
        if (dbErr) return setError('Ya existe un tipo con ese nombre.');
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
                    autoFocus placeholder="Nombre del nuevo tipo"
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
            className="input-base"
        >
            <option value="" disabled>Selecciona un tipo...</option>
            {opciones.map(t => <option key={t} value={t}>{TIPO_LABEL(t)}</option>)}
            <option value="__nuevo__">+ Crear nuevo tipo...</option>
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
function ComprasTab({ viajeId, readOnly, titulo, divisasVersion, tasaTraslado, onTasaChange }) {
    const [items,    setItems]    = useState([]);
    const [divisas,  setDivisas]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const [tasa,     setTasa]     = useState('');
    const EMPTY = { producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', divisa_id: '', fecha: today(), notas: '' };
    const [form, setForm] = useState(EMPTY);
    const { productos, reload: reloadProductos, userId } = useProductos();

    // Sincroniza el input de tasa con el valor que viene del viaje (prop).
    useEffect(() => { setTasa(tasaTraslado != null ? String(tasaTraslado) : ''); }, [tasaTraslado]);

    // Ref para guardar la tasa al desmontar ComprasTab (por si se navegó sin blur).
    const tasaRef = useRef('');
    tasaRef.current = tasa;
    useEffect(() => {
        return () => {
            const valor = Number(tasaRef.current);
            const nuevo = (!isNaN(valor) && valor > 0) ? valor : null;
            supabase.from('viajes').update({ traslado_tasa_por_kg: nuevo }).eq('id', viajeId).then(() => onTasaChange?.(nuevo));
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const load = useCallback(async () => {
        const [cR, dR] = await Promise.all([
            supabase.from('compras').select('*, viaje_divisas(codigo,tasa,es_base)').eq('viaje_id', viajeId).order('fecha', { ascending: false }),
            supabase.from('viaje_divisas').select('*').eq('viaje_id', viajeId).order('es_base', { ascending: false }).order('codigo'),
        ]);
        setItems(cR.data ?? []);
        setDivisas(dR.data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load, divisasVersion]);

    const baseDivisa = divisas.find(d => d.es_base) ?? divisas[0];
    const divisaSel  = divisas.find(d => d.id === (form.divisa_id || baseDivisa?.id)) ?? baseDivisa;
    const tasaNum    = Number(tasa) || 0;

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm({ ...EMPTY, divisa_id: baseDivisa?.id ?? '' }); setEditId(null); setShowForm(false); }
    function openForm()  { setForm({ ...EMPTY, divisa_id: baseDivisa?.id ?? '' }); setEditId(null); setShowForm(true); }
    function startEdit(i) {
        setForm({ producto: i.producto, cantidad: String(i.cantidad), unidad: i.unidad, precio_unitario: String(i.precio_unitario), divisa_id: i.divisa_id ?? baseDivisa?.id ?? '', fecha: i.fecha, notas: i.notas ?? '' });
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
            divisa_id: form.divisa_id || baseDivisa?.id || null,
            fecha: form.fecha, notas: form.notas || null,
        };
        if (editId) await supabase.from('compras').update(payload).eq('id', editId);
        else        await supabase.from('compras').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('compras').delete().eq('id', id); load(); }

    // Guarda la tasa de traslado en el viaje (NULL si vacío o 0).
    async function saveTasa() {
        const valor = Number(tasa);
        const nuevo = (!isNaN(valor) && valor > 0) ? valor : null;
        await supabase.from('viajes').update({ traslado_tasa_por_kg: nuevo }).eq('id', viajeId);
        onTasaChange?.(nuevo);
    }

    // Costo de un item en USD: si es kg, precio + traslado; si no, solo precio.
    function costoItem(i) {
        const precioUsd = montoUsd(1, i.precio_unitario, i.viaje_divisas?.tasa ?? 1);
        const porKg = i.unidad === 'kg' ? costoFinalPorKg(precioUsd, tasaNum) : precioUsd;
        return Number(i.cantidad) * porKg;
    }

    const total = items.reduce((s, i) => s + costoItem(i), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && (
                    <label className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400" title="Costo de traslado por kg (se suma al precio de compra)">
                        <span>Traslado $/kg</span>
                        <input
                            type="number" step="0.0001" min="0" placeholder="0"
                            value={tasa}
                            onChange={e => setTasa(e.target.value)}
                            onBlur={saveTasa}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
                            className="input-base w-20 py-1 text-sm"
                        />
                    </label>
                )}
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : openForm()} open={showForm} />}
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
                    <input required type="number" step="0.01" min="0" placeholder={`Precio de compra (${divisaSel?.codigo ?? 'USD'})`} value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base" />
                    <select value={form.divisa_id || baseDivisa?.id || ''} onChange={sf('divisa_id')} className="input-base">
                        {divisas.map(d => <option key={d.id} value={d.id}>{d.codigo}</option>)}
                    </select>
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin compras registradas. Agrega la primera." />
                    : items.map(i => {
                        const d = i.viaje_divisas ?? { codigo: 'USD', tasa: 1, es_base: true };
                        const precioUsd = montoUsd(1, i.precio_unitario, d.tasa);
                        const esKg = i.unidad === 'kg';
                        const costoPorKg = esKg ? costoFinalPorKg(precioUsd, tasaNum) : precioUsd;
                        const sub = Number(i.cantidad) * costoPorKg;
                        const trasladoExtra = esKg && tasaNum > 0;
                        const line = d.es_base
                            ? `${i.cantidad} ${i.unidad} × $${fmt(costoPorKg)}/kg${trasladoExtra ? ` ($${fmt(precioUsd)} + $${fmt(tasaNum)} traslado)` : ''} = $${fmt(sub)}`
                            : `${i.cantidad} ${i.unidad} × $${fmt(costoPorKg)}/kg${trasladoExtra ? ` ($${fmt(precioUsd)} + $${fmt(tasaNum)} traslado)` : ''} = $${fmt(sub)}`;
                        return (
                            <ItemRow key={i.id}
                                title={i.producto}
                                line={line}
                                date={fmtDate(i.fecha)}
                                note={i.notas}
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

/* ── Ventas Tab ─────────────────────────────────────────── */
function VentasTab({ viajeId, readOnly, titulo, tasaTraslado }) {
    const [items,    setItems]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const EMPTY = { producto: '', cantidad: '', unidad: 'kg', total_recibido: '', fecha: today(), notas: '' };
    const [form, setForm] = useState(EMPTY);
    const { materiales, reload: reloadMateriales, userId } = useMaterialesViaje(viajeId, tasaTraslado);

    const load = useCallback(async () => {
        const { data } = await supabase.from('ventas').select('*').eq('viaje_id', viajeId).order('fecha', { ascending: false });
        setItems(data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load]);

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm(EMPTY); setEditId(null); setShowForm(false); }
    function startEdit(i) {
        const t = i.total_real != null ? i.total_real : Number(i.cantidad) * Number(i.precio_unitario);
        setForm({ producto: i.producto, cantidad: String(i.cantidad), unidad: i.unidad, total_recibido: String(t), fecha: i.fecha, notas: i.notas ?? '' });
        setEditId(i.id);
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const total = Number(form.total_recibido);
        if (!(total > 0)) return;
        const cantidadNum = Number(form.cantidad) || 0;
        const precioDerivado = cantidadNum > 0 ? total / cantidadNum : 0;
        setSaving(true);
        const payload = {
            viaje_id: viajeId, producto: form.producto,
            cantidad: cantidadNum, unidad: form.unidad,
            precio_unitario: precioDerivado,
            total_real: total,
            fecha: form.fecha, notas: form.notas || null,
        };
        if (editId) await supabase.from('ventas').update(payload).eq('id', editId);
        else        await supabase.from('ventas').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('ventas').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + ventaTotal(i.cantidad, i.precio_unitario, i.total_real), 0);
    const materialSel = materiales.find(m => m.nombre === form.producto);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : setShowForm(true)} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleSubmit} saving={saving} label={editId ? 'Guardar cambios' : 'Guardar venta'}>
                    <ProductoField
                        value={form.producto}
                        onChange={v => {
                            const mat = materiales.find(m => m.nombre === v);
                            setForm(f => ({
                                ...f,
                                producto: v,
                                cantidad: mat ? String(mat.cantidad) : f.cantidad,
                                unidad:   mat ? mat.unidad          : f.unidad,
                            }));
                        }}
                        productos={materiales} userId={userId}
                        onCreated={() => reloadMateriales()}
                        permitirCrear={false}
                    />
                    {materialSel && (
                        <div className="col-span-2 card bg-stone-50 dark:bg-slate-800 px-3 py-2 text-sm space-y-0.5">
                            <p className="text-stone-700 dark:text-slate-200">
                                Cantidad: <span className="font-medium tabular">{Number(materialSel.cantidad)} {materialSel.unidad}</span>
                            </p>
                            <p className="text-stone-500 dark:text-slate-400">
                                Costo de compras: <span className="font-medium tabular text-stone-700 dark:text-slate-200">${fmt(materialSel.costoCompras)}</span>
                            </p>
                            {Number(tasaTraslado) > 0 && materialSel.unidad === 'kg' && (
                                <p className="text-stone-500 dark:text-slate-400">
                                    Traslado (${fmt(tasaTraslado)}/kg): <span className="font-medium tabular text-stone-700 dark:text-slate-200">${fmt(materialSel.traslado)}</span>
                                </p>
                            )}
                            <p className="text-stone-700 dark:text-slate-200 font-medium pt-0.5">
                                Total estimado (costo): <span className="tabular">${fmt(materialSel.costoEstimado)}</span>
                            </p>
                        </div>
                    )}
                    <input required type="number" step="0.01" min="0" placeholder="Total recibido ($)" value={form.total_recibido} onChange={sf('total_recibido')} className="input-base col-span-2" />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input placeholder="Notas (opcional)" value={form.notas} onChange={sf('notas')} className="input-base" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin ventas registradas. Agrega la primera." />
                    : items.map(i => {
                        const t = ventaTotal(i.cantidad, i.precio_unitario, i.total_real);
                        return (
                            <ItemRow key={i.id}
                                title={i.producto}
                                line={`${Number(i.cantidad)} ${i.unidad} · $${fmt(t)}`}
                                date={fmtDate(i.fecha)}
                                note={i.notas}
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

/* ── Costos Tab ─────────────────────────────────────────── */
function CostosTab({ viajeId, readOnly, titulo, divisasVersion }) {
    const [items,    setItems]    = useState([]);
    const [divisas,  setDivisas]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const EMPTY = { tipo: 'obreros', descripcion: '', monto: '', divisa_id: '', fecha: today() };
    const [form, setForm] = useState(EMPTY);
    const { tipos, reload: reloadTipos, userId } = useCostoTipos();

    const load = useCallback(async () => {
        const [cR, dR] = await Promise.all([
            supabase.from('costos_adicionales').select('*, viaje_divisas(codigo,tasa,es_base)').eq('viaje_id', viajeId).order('fecha', { ascending: false }),
            supabase.from('viaje_divisas').select('*').eq('viaje_id', viajeId).order('es_base', { ascending: false }).order('codigo'),
        ]);
        setItems(cR.data ?? []);
        setDivisas(dR.data ?? []);
        setLoading(false);
    }, [viajeId]);

    useEffect(() => { load(); }, [load, divisasVersion]);

    const baseDivisa = divisas.find(d => d.es_base) ?? divisas[0];
    const divisaSel  = divisas.find(d => d.id === (form.divisa_id || baseDivisa?.id)) ?? baseDivisa;

    function sf(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }
    function resetForm() { setForm({ ...EMPTY, divisa_id: baseDivisa?.id ?? '' }); setEditId(null); setShowForm(false); }
    function openForm()  { setForm({ ...EMPTY, divisa_id: baseDivisa?.id ?? '' }); setEditId(null); setShowForm(true); }
    function startEdit(i) {
        setForm({ tipo: i.tipo, descripcion: i.descripcion, monto: String(i.monto), divisa_id: i.divisa_id ?? baseDivisa?.id ?? '', fecha: i.fecha });
        setEditId(i.id);
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            viaje_id: viajeId, tipo: form.tipo,
            descripcion: form.descripcion || null, monto: Number(form.monto),
            divisa_id: form.divisa_id || baseDivisa?.id || null,
            fecha: form.fecha,
        };
        if (editId) await supabase.from('costos_adicionales').update(payload).eq('id', editId);
        else        await supabase.from('costos_adicionales').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }

    async function del(id) { await supabase.from('costos_adicionales').delete().eq('id', id); load(); }

    const total = items.reduce((s, i) => s + montoUsd(1, i.monto, i.viaje_divisas?.tasa ?? 1), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : openForm()} open={showForm} />}
            </SectionHeader>

            {showForm && (
                <InlineForm onSubmit={handleSubmit} saving={saving} label={editId ? 'Guardar cambios' : 'Guardar costo'}>
                    <TipoCostoField
                        value={form.tipo}
                        onChange={v => setForm(f => ({ ...f, tipo: v }))}
                        tipos={tipos} userId={userId}
                        onCreated={() => reloadTipos()}
                    />
                    <input type="date" value={form.fecha} onChange={sf('fecha')} className="input-base" />
                    <input required type="number" step="0.01" min="0" placeholder={`Monto (${divisaSel?.codigo ?? 'USD'})`} value={form.monto} onChange={sf('monto')} className="input-base" />
                    <select value={form.divisa_id || baseDivisa?.id || ''} onChange={sf('divisa_id')} className="input-base">
                        {divisas.map(d => <option key={d.id} value={d.id}>{d.codigo}</option>)}
                    </select>
                    <input placeholder="Descripción (opcional)" value={form.descripcion} onChange={sf('descripcion')} className="input-base col-span-2" />
                </InlineForm>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                {loading ? <Spinner />
                    : items.length === 0 ? <EmptyState msg="Sin costos adicionales. Agrega el primero." />
                    : items.map(i => {
                        const Icon = TIPO_ICON[i.tipo] ?? Tag;
                        const d = i.viaje_divisas ?? { codigo: 'USD', tasa: 1, es_base: true };
                        const line = d.es_base
                            ? `${TIPO_LABEL(i.tipo)} · $${fmt(i.monto)}`
                            : `${TIPO_LABEL(i.tipo)} · ${d.codigo} ${fmt(i.monto)} · ≈ $${fmt(montoUsd(1, i.monto, d.tasa))}`;
                        return (
                        <ItemRow key={i.id}
                            title={<span className="inline-flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {i.descripcion || TIPO_LABEL(i.tipo)}</span>}
                            line={line}
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
function ResumenTab({ viajeId, tasaTraslado }) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const [cR, vR, kR] = await Promise.all([
                supabase.from('compras').select('producto,cantidad,unidad,precio_unitario, viaje_divisas(tasa)').eq('viaje_id', viajeId),
                supabase.from('ventas').select('producto,cantidad,unidad,precio_unitario,total_real').eq('viaje_id', viajeId),
                supabase.from('costos_adicionales').select('monto, viaje_divisas(tasa)').eq('viaje_id', viajeId),
            ]);
            const compras = cR.data ?? [], ventas = vR.data ?? [];
            const tasa = Number(tasaTraslado) || 0;
            // Costo de compras: si es kg, precio + tasa de traslado; si no, solo precio.
            const totalCompras = compras.reduce((s, i) => {
                const precioUsd = montoUsd(1, i.precio_unitario, i.viaje_divisas?.tasa ?? 1);
                const porKg = i.unidad === 'kg' ? costoFinalPorKg(precioUsd, tasa) : precioUsd;
                return s + Number(i.cantidad) * porKg;
            }, 0);
            const totalVentas  = ventas.reduce((s, i) => s + ventaTotal(i.cantidad, i.precio_unitario, i.total_real), 0);
            const totalCostos  = (kR.data ?? []).reduce((s, i) => s + montoUsd(1, i.monto, i.viaje_divisas?.tasa ?? 1), 0);

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
    }, [viajeId, tasaTraslado]);

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
        await supabase.from('viaje_divisas').insert({ viaje_id: viajeId, codigo, tasa, es_base: false, fija: false });
        setNueva({ codigo: '', tasa: '' });
        setAdding(false);
        load();
        onChange?.();
    }

    function startEdit(d) {
        const sinConfigurar = d.fija && !d.es_base && Number(d.tasa) === 1;
        setEditId(d.id);
        setEditVal({ codigo: d.codigo, tasa: sinConfigurar ? '' : String(d.tasa) });
    }

    async function saveEdit() {
        const tasa = Number(editVal.tasa);
        if (!(tasa > 0)) return;
        const ed = divisas.find(x => x.id === editId);
        const codigo = editVal.codigo.trim();
        if (!ed?.fija && !codigo) return;
        const update = ed?.fija ? { tasa } : { codigo, tasa };
        await supabase.from('viaje_divisas').update(update).eq('id', editId);
        setEditId(null);
        load();
        onChange?.();
    }

    async function del(d) {
        if (d.fija) return;
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
                    <input type="number" step="0.0001" min="0" placeholder="0" value={nueva.tasa} onChange={e => setNueva(n => ({ ...n, tasa: e.target.value }))} className="input-base flex-1" />
                    <button type="submit" className="btn-secondary text-sm px-3 shrink-0" style={{ width: 'auto' }}>Agregar</button>
                </form>
            )}

            <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2">
                {loading ? <Spinner />
                    : divisas.map(d => {
                        const pendiente = d.fija && !d.es_base && Number(d.tasa) === 1;
                        const editando = editId === d.id;
                        return (
                            <div key={d.id} className={`card py-2.5 px-4 flex items-center gap-3 ${pendiente ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                                {editando ? (
                                    <>
                                        <span className="text-xs text-stone-400 dark:text-slate-500 shrink-0">1 USD =</span>
                                        <input type="number" step="0.0001" min="0" placeholder="0" value={editVal.tasa} onChange={e => setEditVal(v => ({ ...v, tasa: e.target.value }))} className="input-base w-28" />
                                        {d.fija
                                            ? <span className="text-sm text-stone-600 dark:text-slate-300 shrink-0 w-24">{d.codigo}</span>
                                            : <input value={editVal.codigo} onChange={e => setEditVal(v => ({ ...v, codigo: e.target.value }))} className="input-base w-24" />}
                                        <div className="flex-1" />
                                        <button onClick={saveEdit} className="btn-secondary text-sm px-3 shrink-0" style={{ width: 'auto' }}>Guardar</button>
                                        <button onClick={() => setEditId(null)} className="text-stone-400 hover:text-stone-600 px-1 shrink-0 flex items-center"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-stone-800 dark:text-slate-200">
                                                1 USD = {pendiente
                                                    ? <span className="tabular text-stone-300 dark:text-slate-600">0</span>
                                                    : <span className="tabular">{fmt(d.tasa)}</span>
                                                } {d.codigo}
                                                {d.es_base && <span className="text-xs text-stone-400 dark:text-slate-500 ml-2 font-normal">(base)</span>}
                                                {d.fija && !d.es_base && <span className="text-xs text-stone-400 dark:text-slate-500 ml-2 font-normal">(fija)</span>}
                                            </p>
                                            {pendiente && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Configura la tasa del día</p>
                                            )}
                                        </div>
                                        {!readOnly && !d.es_base && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button onClick={() => startEdit(d)} className="text-xs font-medium px-2.5 py-1 rounded-md border border-foreground/30 text-foreground hover:bg-muted transition-colors">
                                                    Poner cambio
                                                </button>
                                                {!d.fija && <DeleteBtn onClick={() => del(d)} />}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })
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
                    <ComprasTab viajeId={id} readOnly={isClosed} titulo="Compras" divisasVersion={divisasVersion} tasaTraslado={viaje?.traslado_tasa_por_kg} onTasaChange={t => setViaje(v => v ? { ...v, traslado_tasa_por_kg: t } : v)} />
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" divisasVersion={divisasVersion} />
                </div>
            )}
            {vista === 'en_curso' && <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" divisasVersion={divisasVersion} />}
            {vista === 'ventas'   && <VentasTab viajeId={id} readOnly={isClosed} titulo="Ventas" tasaTraslado={viaje?.traslado_tasa_por_kg} />}
            {vista === 'resumen'  && <ResumenTab viajeId={id} tasaTraslado={viaje?.traslado_tasa_por_kg} />}

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
