# Lógica y navegación de fases del viaje — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 6 fallas lógicas/de UX en el flujo de fases del viaje: permitir retroceder de fase (hoy prometido en el texto pero inexistente), separar de verdad "Costos iniciales" de "Costos del viaje" en la base de datos, mostrar las compras (solo lectura) fuera de Preparación, mostrar el Resumen de ganancia en vivo durante Ventas, y corregir el autocompletado de cantidad en Ventas para que descuente lo ya vendido.

**Architecture:** Un nuevo helper puro `fasesAnteriores()` en `lib/viajeFases.mjs` (testeado) alimenta un control de retroceso en `ViajeDetallePage`. Una migración agrega `costos_adicionales.fase`, completada automáticamente al crear el costo y usada para filtrar cada instancia de `CostosTab`. `ComprasTab` y `ResumenTab` (componentes ya existentes) se reutilizan tal cual en fases donde antes no se mostraban, sin duplicar lógica. `useMaterialesViaje` resta las ventas ya registradas del total comprado por producto.

**Tech Stack:** Next.js 16 (client components), Supabase (Postgres), `node --test` para los helpers puros.

**Referencia de spec:** `docs/superpowers/specs/2026-09-05-fases-logica-y-navegacion-design.md`

---

## Estructura de archivos

- **Modificar** `lib/viajeFases.mjs` — agregar `fasesAnteriores(fase)`.
- **Modificar** `tests/viaje-fases.test.mjs` — tests de `fasesAnteriores`.
- **Crear** `supabase/migrations/010_costos_fase.sql` — columna `costos_adicionales.fase` + backfill.
- **Modificar** `supabase/schema.sql` — reflejar la nueva columna.
- **Modificar** `app/dashboard/viajes/[id]/page.js` — `CostosTab` (filtro por fase), `useMaterialesViaje`/`VentasTab` (restante), `ViajeDetallePage` (retroceso de fase, Compras/Resumen visibles en más fases).

---

## Task 1: Helper `fasesAnteriores()` + tests (TDD)

**Files:**
- Modify: `lib/viajeFases.mjs`
- Test: `tests/viaje-fases.test.mjs`

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar la línea de import en `tests/viaje-fases.test.mjs`:

```js
import {
  FASES, FASE_META, faseIndex, faseAlcanzada, siguienteFase, avanceConfig, stepperState,
} from '../lib/viajeFases.mjs';
```

por:

```js
import {
  FASES, FASE_META, faseIndex, faseAlcanzada, siguienteFase, avanceConfig, stepperState, fasesAnteriores,
} from '../lib/viajeFases.mjs';
```

Agregar al final del archivo:

```js
test('fasesAnteriores: vacío en preparacion (no hay fase previa)', () => {
  assert.deepEqual(fasesAnteriores('preparacion'), []);
});

test('fasesAnteriores: en en_curso, devuelve preparacion', () => {
  assert.deepEqual(fasesAnteriores('en_curso'), [
    { fase: 'preparacion', label: 'Preparación' },
  ]);
});

test('fasesAnteriores: en ventas, devuelve preparacion y en_curso en orden', () => {
  assert.deepEqual(fasesAnteriores('ventas'), [
    { fase: 'preparacion', label: 'Preparación' },
    { fase: 'en_curso', label: 'En curso' },
  ]);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: FALLA (`fasesAnteriores is not a function` o `undefined`).

- [ ] **Step 3: Implementar `fasesAnteriores`**

Agregar al final de `lib/viajeFases.mjs`:

```js
// Fases anteriores a `fase`, en orden — para el control de "volver a fase anterior".
export function fasesAnteriores(fase) {
  const i = faseIndex(fase);
  if (i <= 0) return [];
  return FASES.slice(0, i).map(f => ({ fase: f, label: FASE_META[f].label }));
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: PASS (14 tests, 0 fallos).

- [ ] **Step 5: Commit**

```bash
git add lib/viajeFases.mjs tests/viaje-fases.test.mjs
git commit -m "feat: helper fasesAnteriores para retroceder de fase"
```

---

## Task 2: Migración — `costos_adicionales.fase`

**Files:**
- Create: `supabase/migrations/010_costos_fase.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/010_costos_fase.sql`:

```sql
-- ============================================================
-- MIGRACIÓN: separar costos por fase
--   Cada costo adicional queda marcado con la fase del viaje en
--   la que fue registrado, para distinguir "Costos iniciales"
--   (preparación) de "Costos del viaje" (en curso) en vez de
--   mostrar el mismo listado con dos títulos distintos.
-- ============================================================

ALTER TABLE public.costos_adicionales
  ADD COLUMN IF NOT EXISTS fase TEXT;

-- Backfill: no hay forma de reconstruir en qué fase se cargó
-- históricamente cada costo, así que se asume 'preparacion' para
-- todo lo existente.
UPDATE public.costos_adicionales
SET fase = 'preparacion'
WHERE fase IS NULL;

COMMENT ON COLUMN public.costos_adicionales.fase IS 'Fase del viaje (preparacion/en_curso) en la que se registró el costo.';
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía Supabase MCP `apply_migration` (name: `costos_fase`, query: el SQL de arriba). Alternativa: pegar en Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 3: Verificar**

Ejecutar vía MCP `execute_sql`:

```sql
SELECT
  (SELECT count(*) FROM public.costos_adicionales WHERE fase IS NULL) AS sin_fase,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='costos_adicionales' AND column_name='fase') AS col_ok;
```
Expected: `sin_fase` = 0, `col_ok` = true.

- [ ] **Step 4: Reflejar en `supabase/schema.sql`**

En `supabase/schema.sql`, dentro de la definición de `CREATE TABLE ... public.costos_adicionales (...)`, agregar la columna después de `divisa_id`:

Reemplazar:

```sql
CREATE TABLE IF NOT EXISTS public.costos_adicionales (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id     UUID           NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  tipo         TEXT           NOT NULL,
  descripcion  TEXT,
  monto        NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  divisa_id    UUID           REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT,
  fecha        DATE           NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costos_viaje ON public.costos_adicionales(viaje_id);

COMMENT ON TABLE  public.costos_adicionales  IS 'Gastos adicionales del viaje: administración, obreros, comida, hotel, gasolina, etc.';
COMMENT ON COLUMN public.costos_adicionales.tipo      IS 'Categoría: administracion, obreros, comida, hotel, gasolina, gasoil, transporte, otro, o custom.';
COMMENT ON COLUMN public.costos_adicionales.divisa_id IS 'Divisa en la que está expresado monto (refiere a viaje_divisas).';
```

por:

```sql
CREATE TABLE IF NOT EXISTS public.costos_adicionales (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id     UUID           NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  tipo         TEXT           NOT NULL,
  descripcion  TEXT,
  monto        NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  divisa_id    UUID           REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT,
  fase         TEXT,
  fecha        DATE           NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costos_viaje ON public.costos_adicionales(viaje_id);

COMMENT ON TABLE  public.costos_adicionales  IS 'Gastos adicionales del viaje: administración, obreros, comida, hotel, gasolina, etc.';
COMMENT ON COLUMN public.costos_adicionales.tipo      IS 'Categoría: administracion, obreros, comida, hotel, gasolina, gasoil, transporte, otro, o custom.';
COMMENT ON COLUMN public.costos_adicionales.divisa_id IS 'Divisa en la que está expresado monto (refiere a viaje_divisas).';
COMMENT ON COLUMN public.costos_adicionales.fase      IS 'Fase del viaje (preparacion/en_curso) en la que se registró el costo.';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_costos_fase.sql supabase/schema.sql
git commit -m "feat(db): columna costos_adicionales.fase para separar costos por fase"
```

---

## Task 3: `CostosTab` filtra por fase

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Cambiar la firma de `CostosTab` y su query**

Reemplazar:

```js
function CostosTab({ viajeId, readOnly, titulo, divisasVersion }) {
```

por:

```js
function CostosTab({ viajeId, readOnly, titulo, divisasVersion, faseFiltro }) {
```

Reemplazar:

```js
    const load = useCallback(async () => {
        const [cR, dR] = await Promise.all([
            supabase.from('costos_adicionales').select('*, viaje_divisas(codigo,tasa,es_base)').eq('viaje_id', viajeId).order('fecha', { ascending: false }),
            supabase.from('viaje_divisas').select('*').eq('viaje_id', viajeId).order('es_base', { ascending: false }).order('codigo'),
        ]);
        setItems(cR.data ?? []);
        setDivisas(dR.data ?? []);
        setLoading(false);
    }, [viajeId]);
```

por:

```js
    const load = useCallback(async () => {
        const [cR, dR] = await Promise.all([
            supabase.from('costos_adicionales').select('*, viaje_divisas(codigo,tasa,es_base)').eq('viaje_id', viajeId).eq('fase', faseFiltro).order('fecha', { ascending: false }),
            supabase.from('viaje_divisas').select('*').eq('viaje_id', viajeId).order('es_base', { ascending: false }).order('codigo'),
        ]);
        setItems(cR.data ?? []);
        setDivisas(dR.data ?? []);
        setLoading(false);
    }, [viajeId, faseFiltro]);
```

- [ ] **Step 2: Completar `fase` automáticamente al crear un costo (no al editar)**

Reemplazar:

```js
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
        else await supabase.from('costos_adicionales').insert(payload);
        setSaving(false);
        resetForm();
        load();
    }
```

por:

```js
    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            viaje_id: viajeId, tipo: form.tipo,
            descripcion: form.descripcion || null, monto: Number(form.monto),
            divisa_id: form.divisa_id || baseDivisa?.id || null,
            fecha: form.fecha,
        };
        // La fase se completa sola al crear (no el usuario) y no se
        // reescribe al editar, para no mover un costo de bucket.
        if (editId) await supabase.from('costos_adicionales').update(payload).eq('id', editId);
        else await supabase.from('costos_adicionales').insert({ ...payload, fase: faseFiltro });
        setSaving(false);
        resetForm();
        load();
    }
```

- [ ] **Step 3: Pasar `faseFiltro` desde `ViajeDetallePage` a cada instancia de `CostosTab`**

Reemplazar:

```jsx
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" divisasVersion={divisasVersion} />
```

por:

```jsx
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" divisasVersion={divisasVersion} faseFiltro="preparacion" />
```

Reemplazar:

```jsx
            {vista === 'en_curso' && <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" divisasVersion={divisasVersion} />}
```

por:

```jsx
            {vista === 'en_curso' && <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" divisasVersion={divisasVersion} faseFiltro="en_curso" />}
```

(Nota: en la Task 5 este bloque se reemplaza de nuevo para agregar Compras de referencia — el reemplazo de esta Task 3 es intermedio y válido igual, no rompe nada si la Task 5 se aplica después.)

- [ ] **Step 4: Filtrar también el mini-resumen de "En curso" en `useFaseResumen`**

Para que el conteo/gasto mostrado en el resumen dinámico de la fase En curso coincida con lo que `CostosTab` (con `faseFiltro="en_curso"`) realmente muestra, reemplazar dentro de `useFaseResumen`:

```js
        } else if (fase === 'en_curso') {
            const { data } = await supabase.from('costos_adicionales').select('monto, viaje_divisas(tasa)').eq('viaje_id', viajeId);
```

por:

```js
        } else if (fase === 'en_curso') {
            const { data } = await supabase.from('costos_adicionales').select('monto, viaje_divisas(tasa)').eq('viaje_id', viajeId).eq('fase', 'en_curso');
```

- [ ] **Step 5: Verificar que compila**

Con el dev server corriendo, run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 6: Verificación manual**

Entrar a un viaje, en Preparación cargar un costo (queda con `fase='preparacion'`), avanzar a "En curso" y confirmar que **no aparece** en "Costos del viaje". Cargar un costo ahí y confirmar que sí aparece, y que la mini-stat "Costos"/"Gastado" de la fase En curso coincide con ese listado (no con el total combinado).

- [ ] **Step 7: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: separar Costos iniciales de Costos del viaje por fase real"
```

---

## Task 4: Ventas no sugiere cantidades ya vendidas

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: `useMaterialesViaje` resta lo ya vendido**

Reemplazar la función completa:

```js
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
```

por:

```js
function useMaterialesViaje(viajeId, tasaTraslado) {
    const { user } = useAuth();
    const [materiales, setMateriales] = useState([]);

    const load = useCallback(async () => {
        if (!user) return;
        const [cR, vR] = await Promise.all([
            supabase.from('compras')
                .select('producto,unidad,cantidad,precio_unitario, viaje_divisas(tasa)')
                .eq('viaje_id', viajeId),
            supabase.from('ventas').select('producto,cantidad').eq('viaje_id', viajeId),
        ]);
        const map = new Map();
        (cR.data ?? []).forEach(c => {
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
        // Cuánto se vendió ya de cada producto, para calcular el restante.
        const vendidoPorProducto = new Map();
        (vR.data ?? []).forEach(v => {
            if (!v.producto) return;
            vendidoPorProducto.set(v.producto, (vendidoPorProducto.get(v.producto) ?? 0) + Number(v.cantidad));
        });
        const tasa = Number(tasaTraslado) || 0;
        const lista = [...map.values()].map(m => {
            const traslado = m.unidad === 'kg' ? m.cantidad * tasa : 0;
            const costoTotal = m.costoCompras + traslado;
            const vendido = vendidoPorProducto.get(m.nombre) ?? 0;
            return {
                ...m,
                costoEstimado: costoTotal,
                costoCompras: m.costoCompras,
                traslado,
                vendido,
                restante: m.cantidad - vendido,
                label: `${m.nombre} (${Number(m.cantidad)} ${m.unidad})`,
            };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
        setMateriales(lista);
    }, [user, viajeId, tasaTraslado]);

    useEffect(() => { load(); }, [load]);

    return { materiales, reload: load, userId: user?.id };
}
```

- [ ] **Step 2: El formulario de venta autocompleta con el restante, no el total comprado**

Reemplazar dentro de `VentasTab`:

```jsx
                    <ProductoField
                        value={form.producto}
                        onChange={v => {
                            const mat = materiales.find(m => m.nombre === v);
                            setForm(f => ({
                                ...f,
                                producto: v,
                                cantidad: mat ? String(mat.cantidad) : f.cantidad,
                                unidad: mat ? mat.unidad : f.unidad,
                            }));
                        }}
                        productos={materiales} userId={userId}
                        onCreated={() => reloadMateriales()}
                        permitirCrear={false}
                    />
```

por:

```jsx
                    <ProductoField
                        value={form.producto}
                        onChange={v => {
                            const mat = materiales.find(m => m.nombre === v);
                            setForm(f => ({
                                ...f,
                                producto: v,
                                cantidad: mat ? String(mat.restante) : f.cantidad,
                                unidad: mat ? mat.unidad : f.unidad,
                            }));
                        }}
                        productos={materiales} userId={userId}
                        onCreated={() => reloadMateriales()}
                        permitirCrear={false}
                    />
```

- [ ] **Step 3: Mostrar el restante en la tarjeta de info del producto seleccionado**

Reemplazar:

```jsx
                    {materialSel && (
                        <div className="col-span-2 card bg-stone-50 dark:bg-slate-800 px-3 py-2 text-sm space-y-0.5">
                            <p className="text-stone-700 dark:text-slate-200">
                                Cantidad: <span className="font-medium tabular">{Number(materialSel.cantidad)} {materialSel.unidad}</span>
                            </p>
                            <p className="text-stone-500 dark:text-slate-400">
                                Costo de compras: <span className="font-medium tabular text-stone-700 dark:text-slate-200">${fmt(materialSel.costoCompras)}</span>
                            </p>
```

por:

```jsx
                    {materialSel && (
                        <div className="col-span-2 card bg-stone-50 dark:bg-slate-800 px-3 py-2 text-sm space-y-0.5">
                            <p className="text-stone-700 dark:text-slate-200">
                                Cantidad comprada: <span className="font-medium tabular">{Number(materialSel.cantidad)} {materialSel.unidad}</span>
                            </p>
                            <p className="text-stone-500 dark:text-slate-400">
                                Restante: <span className="font-medium tabular text-stone-700 dark:text-slate-200">{fmt(materialSel.restante)} {materialSel.unidad}</span>
                            </p>
                            <p className="text-stone-500 dark:text-slate-400">
                                Costo de compras: <span className="font-medium tabular text-stone-700 dark:text-slate-200">${fmt(materialSel.costoCompras)}</span>
                            </p>
```

(No se agrega ninguna validación que bloquee vender más del restante — es solo informativo, según la spec.)

- [ ] **Step 4: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 5: Verificación manual**

Comprar 10 kg de un producto, venderlo parcialmente (ej. 4 kg), y confirmar que al elegir el mismo producto de nuevo en el form de venta, la cantidad autocompletada es 6 (no 10), y la tarjeta de info muestra "Restante: 6 kg".

- [ ] **Step 6: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "fix: autocompletado de Ventas descuenta lo ya vendido (restante real)"
```

---

## Task 5: Compras visible (solo lectura) fuera de Preparación + Resumen en vivo en Ventas

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Reemplazar el bloque de contenido de fases en `ViajeDetallePage`**

Reemplazar (el bloque ya tiene `faseFiltro` de la Task 3):

```jsx
            {/* Contenido de la fase actual */}
            {vista === 'preparacion' && (
                <div className="space-y-6">
                    <DivisasPanel viajeId={id} readOnly={isClosed} onChange={() => setDivisasVersion(v => v + 1)} />
                    <ComprasTab viajeId={id} readOnly={isClosed} titulo="Compras" divisasVersion={divisasVersion} tasaTraslado={viaje?.traslado_tasa_por_kg} onTasaChange={t => setViaje(v => v ? { ...v, traslado_tasa_por_kg: t } : v)} />
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" divisasVersion={divisasVersion} faseFiltro="preparacion" />
                </div>
            )}
            {vista === 'en_curso' && <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" divisasVersion={divisasVersion} faseFiltro="en_curso" />}
            {vista === 'ventas' && <VentasTab viajeId={id} readOnly={isClosed} titulo="Ventas" tasaTraslado={viaje?.traslado_tasa_por_kg} />}
            {vista === 'resumen' && <ResumenTab viajeId={id} tasaTraslado={viaje?.traslado_tasa_por_kg} />}
```

por:

```jsx
            {/* Contenido de la fase actual */}
            {vista === 'preparacion' && (
                <div className="space-y-6">
                    <DivisasPanel viajeId={id} readOnly={isClosed} onChange={() => setDivisasVersion(v => v + 1)} />
                    <ComprasTab viajeId={id} readOnly={isClosed} titulo="Compras" divisasVersion={divisasVersion} tasaTraslado={viaje?.traslado_tasa_por_kg} onTasaChange={t => setViaje(v => v ? { ...v, traslado_tasa_por_kg: t } : v)} />
                    <CostosTab  viajeId={id} readOnly={isClosed} titulo="Costos iniciales" divisasVersion={divisasVersion} faseFiltro="preparacion" />
                </div>
            )}
            {vista === 'en_curso' && (
                <div className="space-y-6">
                    <CostosTab viajeId={id} readOnly={isClosed} titulo="Costos del viaje" divisasVersion={divisasVersion} faseFiltro="en_curso" />
                    <ComprasTab viajeId={id} readOnly={true} titulo="Compras (referencia)" divisasVersion={divisasVersion} tasaTraslado={viaje?.traslado_tasa_por_kg} />
                </div>
            )}
            {vista === 'ventas' && (
                <div className="space-y-6">
                    <VentasTab viajeId={id} readOnly={isClosed} titulo="Ventas" tasaTraslado={viaje?.traslado_tasa_por_kg} />
                    <ComprasTab viajeId={id} readOnly={true} titulo="Compras (referencia)" divisasVersion={divisasVersion} tasaTraslado={viaje?.traslado_tasa_por_kg} />
                    <ResumenTab viajeId={id} tasaTraslado={viaje?.traslado_tasa_por_kg} />
                </div>
            )}
            {vista === 'resumen' && <ResumenTab viajeId={id} tasaTraslado={viaje?.traslado_tasa_por_kg} />}
```

(`ComprasTab` con `readOnly={true}` fijo no muestra el formulario de alta ni los botones de editar/borrar — ya es el comportamiento existente del componente, no requiere cambios internos. Tampoco se le pasa `onTasaChange`: al ser solo lectura, el input de traslado no se renderiza.)

- [ ] **Step 2: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.
Run: `tail -25 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined|unexpected" | grep -viE "fetching profile|set-state-in-effect"`
Expected: sin salida.

- [ ] **Step 3: Verificación manual**

Avanzar un viaje a "En curso": confirmar que debajo de "Costos del viaje" aparece "Compras (referencia)" con la lista de compras, sin botón "+ Agregar" ni editar/borrar. Avanzar a "Ventas": confirmar que aparecen Ventas, luego Compras de referencia, y luego el Resumen completo (ganancia/pérdida + sobrante) sin necesidad de cerrar el viaje.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: Compras de referencia fuera de Preparación + Resumen en vivo en Ventas"
```

---

## Task 6: Control "Volver a fase anterior"

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Importar `fasesAnteriores`**

Reemplazar:

```js
import { avanceConfig, stepperState } from '@/lib/viajeFases.mjs';
```

por:

```js
import { avanceConfig, stepperState, fasesAnteriores } from '@/lib/viajeFases.mjs';
```

- [ ] **Step 2: Agregar el componente `VolverFaseControl`**

Insertar, justo antes del comentario `/* ── Main Page ──────────────────────────────────────────── */`:

```jsx
/* ── Control de retroceso de fase ────────────────────────────
   Solo lista fases anteriores a la actual; retroceder no borra
   ni oculta datos, solo cambia qué sección se muestra. */
function VolverFaseControl({ fase, onVolver, disabled }) {
    const anteriores = fasesAnteriores(fase);
    if (anteriores.length === 0) return null;
    return (
        <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Volver a:</span>
            {anteriores.map(f => (
                <button
                    key={f.fase}
                    type="button"
                    disabled={disabled}
                    onClick={() => onVolver(f.fase, f.label)}
                    className="px-2.5 py-1 rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Agregar el estado y el handler en `ViajeDetallePage`**

Reemplazar:

```js
    const [advancing, setAdvancing] = useState(false);
    const [closing,   setClosing]   = useState(false);
```

por:

```js
    const [advancing,   setAdvancing]   = useState(false);
    const [closing,     setClosing]     = useState(false);
    const [retroceding, setRetroceding] = useState(false);
```

Agregar, justo después de la función `handleAvanzar`:

```js
    async function handleRetroceder(fase, label) {
        if (!confirm(`¿Volver a la fase "${label}"? Los datos ya cargados (compras, costos, ventas) no se pierden — solo cambia qué sección ves.`)) return;
        setRetroceding(true);
        await supabase.from('viajes').update({ fase }).eq('id', id);
        setViaje(v => ({ ...v, fase }));
        setRetroceding(false);
    }
```

- [ ] **Step 4: Mostrar el control junto al stepper**

Reemplazar:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && (
                <div className="space-y-3">
                    <FaseStepper fase={viaje.fase} />
                    <FaseResumen fase={viaje.fase} resumen={resumenFase} />
                </div>
            )}
```

por:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && (
                <div className="space-y-3">
                    <FaseStepper fase={viaje.fase} />
                    <FaseResumen fase={viaje.fase} resumen={resumenFase} />
                    <VolverFaseControl fase={viaje.fase} onVolver={handleRetroceder} disabled={retroceding} />
                </div>
            )}
```

- [ ] **Step 5: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 6: Verificación manual**

En un viaje en fase "En curso", confirmar que aparece "Volver a: Preparación". Click, confirmar el diálogo, y verificar que vuelve a mostrar la vista de Preparación (Divisas, Compras, Costos iniciales) con todo lo cargado previamente intacto. Avanzar de nuevo y confirmar que el viaje sigue funcionando con normalidad. En "Ventas", confirmar que aparecen dos botones: "Preparación" y "En curso".

- [ ] **Step 7: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: permitir volver a cualquier fase anterior del viaje"
```

---

## Task 7: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la suite de tests unitarios**

Run: `node --test tests/*.test.mjs`
Expected: todos los tests PASS, incluidos los 3 nuevos de `fasesAnteriores`.

- [ ] **Step 2: Verificación manual end-to-end del flujo completo**

Con el dev server corriendo y un viaje de prueba:
1. En Preparación: configurar divisas, cargar 2-3 compras, cargar un costo inicial.
2. Avanzar a "En curso": confirmar que el costo inicial NO aparece en "Costos del viaje"; cargar un costo ahí; confirmar que la sección "Compras (referencia)" muestra las compras sin poder editarlas.
3. Avanzar a "Ventas": vender parcialmente uno de los productos comprados; confirmar que el Resumen (ganancia/sobrante) se ve en vivo, debajo de Ventas, sin cerrar el viaje.
4. Volver a "Preparación" con el nuevo control, confirmar que nada se perdió, y avanzar de nuevo hasta Ventas.
5. Cerrar el viaje y confirmar que el Resumen final sigue siendo correcto (mismos números que se veían en vivo).

- [ ] **Step 3: Fix de ajustes menores si aparecen**

Si la verificación manual encuentra algo puntual a corregir, hacer un commit de fix dedicado (`git commit -m "fix: ..."`) antes de cerrar el ciclo — no dejarlo sin commitear.

---

## Self-review (cobertura del spec)

- **1. Retroceder a cualquier fase anterior** — Task 1 (`fasesAnteriores`) + Task 6 (`VolverFaseControl`, `handleRetroceder`). No borra datos (solo cambia `viaje.fase`). ✓
- **2. Separación real Costos iniciales / Costos del viaje** — Task 2 (migración + columna) + Task 3 (`faseFiltro`, fase automática al crear, filtro también en `useFaseResumen`). ✓
- **3. Ver compras fuera de Preparación (solo lectura)** — Task 5 (`ComprasTab` con `readOnly={true}` fijo en En curso y Ventas). ✓
- **4. Divisas/traslado sin nuevos controles** — decisión explícita de la spec, no requiere tarea (se resuelve con el retroceso de la Task 6). ✓
- **5. Resumen en vivo en Ventas** — Task 5 (`ResumenTab` renderizado dentro de `vista === 'ventas'`). ✓
- **6. Autocompletado de Ventas usa restante, no total histórico** — Task 4 (`useMaterialesViaje` resta ventas, `VentasTab` usa `restante`, tarjeta de info muestra "Restante"). ✓
