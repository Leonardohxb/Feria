# Divisas por viaje + flujo "una fase a la vez" — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el detalle del viaje una fase a la vez (sin stepper) y permitir registrar compras en distintas divisas por viaje (USD base + Bs, editables/borrables), dejando plasmada la tasa del día.

**Architecture:** Nueva tabla `viaje_divisas` (sembrada por trigger con USD+Bs), `compras.divisa_id` + `precio_unitario` en la divisa elegida. La conversión a USD (`cantidad × precio ÷ tasa`) vive en un helper puro testeado. La UI del detalle deja de usar el stepper (se deriva la vista de `viaje.fase`/`estado`) y agrega un panel de divisas en la Preparación más un selector de divisa en el form de compra.

**Tech Stack:** Next.js 16 (client components), Supabase (Postgres + RLS + trigger), Tailwind v4 tema neutro, lucide-react. Tests: `node --test` (helper puro), Playwright (e2e).

**Referencia de spec:** `docs/superpowers/specs/2026-08-06-viaje-divisas-y-flujo-una-fase-design.md`

---

## Estructura de archivos

- **Crear** `supabase/migrations/004_viaje_divisas.sql` — tabla, trigger, `compras.divisa_id`, siembra de existentes.
- **Modificar** `supabase/schema.sql` — reflejar `viaje_divisas`, el trigger y `compras.divisa_id`.
- **Crear** `lib/divisas.mjs` — helper puro `montoUsd`.
- **Crear** `tests/divisas.test.mjs` — unit test del helper.
- **Modificar** `app/dashboard/viajes/[id]/page.js` — (a) flujo una fase a la vez; (b) `DivisasPanel`; (c) integración de divisa en `ComprasTab`; (d) totales USD en `ResumenTab`.
- **Modificar** `tests/feria-e2e.spec.js` — adaptar el flujo (sin stepper) y el selector de divisa.

---

## Task 1: Migración — `viaje_divisas`, trigger y `compras.divisa_id`

**Files:**
- Create: `supabase/migrations/004_viaje_divisas.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/004_viaje_divisas.sql`:

```sql
-- ============================================================
-- MIGRACIÓN: divisas por viaje
--   Cada viaje tiene sus divisas (USD base + Bs por defecto).
--   Las compras guardan su precio en la divisa elegida.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.viaje_divisas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,
  tasa       NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tasa > 0),  -- unidades por 1 USD
  es_base    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_viaje_divisas_viaje ON public.viaje_divisas(viaje_id);
COMMENT ON COLUMN public.viaje_divisas.tasa IS 'Unidades de la divisa por 1 USD (USD = 1).';

ALTER TABLE public.viaje_divisas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viaje_divisas_own"
  ON public.viaje_divisas FOR ALL
  USING     (EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid()));

-- Trigger: sembrar USD + Bs al crear un viaje
CREATE OR REPLACE FUNCTION public.seed_viaje_divisas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
  VALUES (NEW.id, 'USD', 1, TRUE),
         (NEW.id, 'Bs',  1, FALSE);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_viaje_created_seed_divisas ON public.viajes;
CREATE TRIGGER on_viaje_created_seed_divisas
  AFTER INSERT ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.seed_viaje_divisas();

-- compras: divisa de cada compra (precio_unitario pasa a estar en esa divisa)
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS divisa_id UUID REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT;

-- Sembrar divisas para viajes existentes (previos al trigger)
INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
SELECT v.id, 'USD', 1, TRUE FROM public.viajes v
WHERE NOT EXISTS (SELECT 1 FROM public.viaje_divisas d WHERE d.viaje_id = v.id AND d.codigo = 'USD');

INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
SELECT v.id, 'Bs', 1, FALSE FROM public.viajes v
WHERE NOT EXISTS (SELECT 1 FROM public.viaje_divisas d WHERE d.viaje_id = v.id AND d.codigo = 'Bs');

-- Marcar compras existentes con la divisa USD de su viaje (sus precios ya estaban en USD)
UPDATE public.compras c
SET divisa_id = d.id
FROM public.viaje_divisas d
WHERE d.viaje_id = c.viaje_id AND d.codigo = 'USD' AND c.divisa_id IS NULL;
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía Supabase MCP `apply_migration` (name: `viaje_divisas`, query: el SQL de arriba). Alternativa: pegar en Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 3: Verificar**

Ejecutar vía MCP `execute_sql`:

```sql
SELECT
  (SELECT count(*) FROM public.viaje_divisas) AS divisas,
  (SELECT count(*) FROM public.compras WHERE divisa_id IS NULL) AS compras_sin_divisa,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras' AND column_name='divisa_id') AS col_ok;
```
Expected: `divisas` ≥ 2×(nº de viajes), `compras_sin_divisa` = 0, `col_ok` = true.

- [ ] **Step 4: Reflejar en `supabase/schema.sql`**

En `supabase/schema.sql`, después del bloque de la tabla `viajes` (tras sus índices/comentarios, antes de `-- 4. TABLA: productos`), agregar:

```sql
-- viaje_divisas: divisas propias de cada viaje (USD base + Bs por defecto)
CREATE TABLE IF NOT EXISTS public.viaje_divisas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,
  tasa       NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tasa > 0),
  es_base    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, codigo)
);
```

Y en la definición de `CREATE TABLE ... public.compras (...)`, agregar la columna después de `precio_unitario`:

```sql
  divisa_id        UUID           REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT,
```

(El trigger y el detalle completo quedan documentados en la migración; el schema fuente refleja la estructura.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_viaje_divisas.sql supabase/schema.sql
git commit -m "feat(db): divisas por viaje (viaje_divisas + trigger + compras.divisa_id)"
```

---

## Task 2: Helper puro de conversión + test (TDD)

**Files:**
- Create: `lib/divisas.mjs`
- Test: `tests/divisas.test.mjs`

- [ ] **Step 1: Escribir el test que falla**

Create `tests/divisas.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montoUsd } from '../lib/divisas.mjs';

test('montoUsd: USD (tasa 1) devuelve cantidad × precio', () => {
  assert.equal(montoUsd(10, 5, 1), 50);
  assert.equal(montoUsd(11, 122, 1), 1342);
});

test('montoUsd: divisa con tasa convierte a USD (÷ tasa)', () => {
  assert.equal(montoUsd(1, 80, 40), 2);      // 1 × 80 Bs ÷ 40 = 2 USD
  assert.equal(montoUsd(2, 200, 40), 10);    // 2 × 200 Bs ÷ 40 = 10 USD
});

test('montoUsd: valores inválidos/nulos dan 0 o no rompen', () => {
  assert.equal(montoUsd(undefined, 5, 40), 0);
  assert.equal(montoUsd(10, undefined, 40), 0);
  assert.equal(montoUsd(10, 5, 0), 50);      // tasa 0/ inválida cae a 1
  assert.equal(montoUsd(10, 5, null), 50);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test tests/divisas.test.mjs`
Expected: FALLA (`Cannot find module '.../lib/divisas.mjs'`).

- [ ] **Step 3: Implementar**

Create `lib/divisas.mjs`:

```js
// Conversión de un monto en una divisa a USD.
// tasa = unidades de la divisa por 1 USD (USD tiene tasa 1).
export function montoUsd(cantidad, precioEnDivisa, tasa) {
  const t = Number(tasa) > 0 ? Number(tasa) : 1;
  return (Number(cantidad) || 0) * (Number(precioEnDivisa) || 0) / t;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test tests/divisas.test.mjs`
Expected: PASS (3 tests, 0 fallos).

- [ ] **Step 5: Commit**

```bash
git add lib/divisas.mjs tests/divisas.test.mjs
git commit -m "feat: helper puro de conversión de divisas a USD + tests"
```

---

## Task 3: Flujo "una fase a la vez" (sin stepper)

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js` — el import de fases y la función `ViajeDetallePage`.

- [ ] **Step 1: Ajustar el import de fases**

Reemplazar la línea de import de `@/lib/viajeFases.mjs` por (cambia `faseAlcanzada` → `faseIndex`):

```js
import { FASES, FASE_META, faseIndex, avanceConfig } from '@/lib/viajeFases.mjs';
```

- [ ] **Step 2: Reemplazar `ViajeDetallePage`**

Reemplazar toda la función `export default function ViajeDetallePage() { ... }` (desde su declaración hasta el `}` final del archivo) por:

```jsx
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
```

**Orden de ejecución:** hacé la **Task 4 (`DivisasPanel`) ANTES que esta** para que el componente exista cuando `ViajeDetallePage` lo referencie. `ComprasTab` todavía no acepta `divisasVersion` (llega en la Task 5) pero React ignora un prop desconocido, así que compila igual (solo no refresca tasas en vivo hasta la Task 5).

- [ ] **Step 3: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200` (con la Task 4 ya aplicada). Un 500 indica que falta crear `DivisasPanel`.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: flujo del viaje una fase a la vez (sin stepper, resumen al cerrar)"
```

---

## Task 4: `DivisasPanel` (panel de divisas en Preparación)

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js` — agregar el componente `DivisasPanel` (antes de `/* ── Main Page ── */`).

- [ ] **Step 1: Agregar el componente `DivisasPanel`**

Insertar, justo antes del comentario `/* ── Main Page ──────────────────────────────────────────── */`:

```jsx
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
```

- [ ] **Step 2: Verificar que compila**

Con el dev server en http://localhost:3000:
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.
Run: `tail -25 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined|unexpected" | grep -viE "fetching profile|set-state-in-effect"`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: panel de divisas del viaje (crear/editar/borrar con reasignación a USD)"
```

---

## Task 5: Integrar divisa en `ComprasTab`

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js` — import de `montoUsd` + la función `ComprasTab`.

- [ ] **Step 1: Importar el helper de conversión**

Agregar bajo el import de `@/lib/viajeFases.mjs`:

```js
import { montoUsd } from '@/lib/divisas.mjs';
```

- [ ] **Step 2: Reemplazar la función `ComprasTab` completa**

Reemplazar toda la función `function ComprasTab({ viajeId, readOnly, titulo }) { ... }` (hasta su `}` de cierre, antes de `/* ── Ventas Tab ── */`) por:

```jsx
function ComprasTab({ viajeId, readOnly, titulo, divisasVersion }) {
    const [items,    setItems]    = useState([]);
    const [divisas,  setDivisas]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [editId,   setEditId]   = useState(null);
    const EMPTY = { producto: '', cantidad: '', unidad: 'kg', precio_unitario: '', divisa_id: '', fecha: today(), notas: '' };
    const [form, setForm] = useState(EMPTY);
    const { productos, reload: reloadProductos, userId } = useProductos();

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

    const total = items.reduce((s, i) => s + montoUsd(i.cantidad, i.precio_unitario, i.viaje_divisas?.tasa ?? 1), 0);

    return (
        <div className="space-y-2.5">
            <SectionHeader titulo={titulo} count={items.length} total={total} color="text-foreground">
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
                    <input required type="number" step="0.01" min="0" placeholder={`Precio por unidad (${divisaSel?.codigo ?? 'USD'})`} value={form.precio_unitario} onChange={sf('precio_unitario')} className="input-base" />
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
                        const sub = Number(i.cantidad) * Number(i.precio_unitario);
                        const line = d.es_base
                            ? `${i.cantidad} ${i.unidad} × $${fmt(i.precio_unitario)} = $${fmt(sub)}`
                            : `${i.cantidad} ${i.unidad} × ${d.codigo} ${fmt(i.precio_unitario)} = ${d.codigo} ${fmt(sub)} · ≈ $${fmt(montoUsd(i.cantidad, i.precio_unitario, d.tasa))}`;
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
```

- [ ] **Step 3: Verificar compilación**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`, sin errores en el dev log (mismo grep que antes).

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: elegir divisa al registrar compras + conversión a USD en totales"
```

---

## Task 6: Totales USD en `ResumenTab` + e2e

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js` — `ResumenTab` (traer divisa de cada compra).
- Modify: `tests/feria-e2e.spec.js` — adaptar al flujo sin stepper y al selector de divisa.

- [ ] **Step 1: Ajustar el cálculo de compras en `ResumenTab`**

En `ResumenTab`, dentro de `load()`, reemplazar la línea del `Promise.all` que trae compras:

```js
                supabase.from('compras').select('producto,cantidad,unidad,precio_unitario').eq('viaje_id', viajeId),
```
por (agrega la divisa):
```js
                supabase.from('compras').select('producto,cantidad,unidad,precio_unitario, viaje_divisas(tasa)').eq('viaje_id', viajeId),
```

Y reemplazar el cálculo de `totalCompras`:
```js
            const totalCompras = compras.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
```
por (convierte a USD con la tasa de la compra):
```js
            const totalCompras = compras.reduce((s, i) => s + montoUsd(i.cantidad, i.precio_unitario, i.viaje_divisas?.tasa ?? 1), 0);
```

(La tabla de "sobrante por producto" usa `cantidad` en unidades, no montos, así que no cambia.)

- [ ] **Step 2: Verificar compilación**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 3: Adaptar el e2e al flujo sin stepper**

En `tests/feria-e2e.spec.js`, en `runDashboardTests`:

3a. Reemplazar el bloque de aserciones de fase inicial (las líneas que verifican `button:has-text("Preparación")`, `h2 Compras`, `h2 Costos iniciales`, `button:has-text("Resumen")` y `button:has-text("Ventas")[disabled]`) por:

```js
    // Flujo una fase a la vez: indicador "Preparación", sin stepper de 3 pasos.
    await expect(page.locator('text=Preparación')).toBeVisible();
    await expect(page.locator('h2:has-text("Divisas del viaje")')).toBeVisible();
    await expect(page.locator('h2:has-text("Compras")')).toBeVisible();
    await expect(page.locator('h2:has-text("Costos iniciales")')).toBeVisible();
    // Ventas no está visible en preparación (no hay sección ni paso Ventas todavía)
    await expect(page.locator('h2:has-text("Ventas")')).toHaveCount(0);
```

3b. En el alta de compra, el form ahora tiene un select de divisa además de producto y unidad. Reemplazar la línea:
```js
    await page.selectOption('select', { label: 'Tomate E2E' });
```
(la que está tras el primer `click('button:has-text("Agregar")')`) por una selección específica del select de producto:
```js
    await page.locator('select', { has: page.locator('option', { hasText: 'Tomate E2E' }) }).selectOption({ label: 'Tomate E2E' });
```
(La divisa queda en USD por defecto, así el precio se interpreta en USD y los totales no cambian.)

3c. Igual para el segundo alta de compra editada — el `startEdit` reusa el mismo form; la edición de cantidad no toca el select, así que no requiere cambios ahí.

3d. Quitar la línea que volvía al paso Ventas por el stepper (ya no existe):
```js
    await page.locator('button:has-text("Ventas")').first().click(); // volver al paso Ventas del stepper
```
Eliminarla por completo.

3e. Mover la verificación del Resumen a **después** de cerrar (ahora el Resumen solo aparece al cerrar). Es decir: el bloque `// 7. Resumen (Summary) Checking` que hace `page.click('button:has-text("Resumen")')` y verifica los totales debe ir **después** del bloque de cierre (`// 8. Cerrar viaje`), y sin el click a "Resumen" (ya se muestra solo). Reordenar así:

```js
    // 8. Cerrar viaje — botón en la fase Ventas
    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('¿Cerrar este viaje?');
        await dialog.accept();
    });
    await page.click('button:has-text("Cerrar viaje")');

    // Al cerrar, se muestra el Resumen automáticamente
    await expect(page.locator('span.badge:has-text("Cerrado")')).toBeVisible();
    await expect(page.locator('div.stat-green >> p.stat-value')).toContainText('$120,00');
    await expect(page.locator('div.stat-orange >> p.stat-value')).toContainText('$100,00');
    await expect(page.locator('div.stat-amber >> p.stat-value')).toContainText('$10,00');
    await expect(page.locator('text=Ganancia neta >> xpath=.. >> p.text-xl')).toContainText('+$10,00');
```

(Eliminar el viejo bloque `// 7. Resumen (Summary) Checking` que iba antes del cierre, y la verificación de "readOnly / Agregar no visible" que dependía de volver a Compras por el stepper — en su lugar basta con el badge "Cerrado".)

- [ ] **Step 4: Correr el e2e**

Run: `npx playwright test tests/feria-e2e.spec.js --project=chromium -g "Dashboard"`
Expected: pasa si `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` están en `.env.local` (los datos de test previos del usuario deben estar limpios; el coordinador limpia productos/viajes del usuario de test antes de correr). Si se saltan por falta de credenciales, verificar manualmente: crear viaje, ver panel de divisas, poner tasa de Bs, registrar una compra en Bs y confirmar el equivalente USD.

- [ ] **Step 5: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js" tests/feria-e2e.spec.js
git commit -m "feat: totales del resumen en USD + e2e del flujo una fase y divisas"
```

---

## Self-review (cobertura del spec)

- **A) Una fase a la vez** — Task 3: se elimina stepper, vista derivada de `viaje.fase`/`estado`, indicador "Paso N de 3", resumen al cerrar. ✓
- Sin retroceso — Task 3: no hay navegación hacia atrás. ✓
- **B) Tabla `viaje_divisas` + trigger USD/Bs** — Task 1. ✓
- `compras.divisa_id` + `precio_unitario` en divisa — Task 1 (DB) + Task 5 (uso). ✓
- Migración de existentes (divisas + compras a USD) — Task 1. ✓
- Conversión a USD (`cantidad × precio ÷ tasa`) — Task 2 (helper) + Tasks 5/6 (uso). ✓
- Panel de divisas arriba en Preparación (crear/editar/borrar, reasignar a USD al borrar) — Task 4. ✓
- Selector de divisa en form de compra + display divisa/USD por item — Task 5. ✓
- Totales de compras/resumen en USD — Tasks 5 y 6. ✓
- e2e adaptado — Task 6. ✓
- USD base fija (no editable/borrable) — Task 4 (`!d.es_base` gatea edición/borrado). ✓
