# Fases dinámicas + vistas Lista/Tarjetas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el indicador de fase de texto plano por un stepper de píldoras animado con un resumen dinámico de progreso, y agregar una vista de tarjetas (además de la lista actual) con un toggle, para Compras del viaje e Inventario global.

**Architecture:** Helper puro `stepperState()` en `lib/viajeFases.mjs` (testeado) alimenta un nuevo componente `FaseStepper`. Un hook `useFaseResumen` trae mini-stats por fase con queries livianas y las muestra en `FaseResumen` (reusando el patrón visual `stat-tile` ya existente). Dos componentes compartidos nuevos — `ViewToggle` (+ hook `useViewPreference` con `localStorage`) y `ProductCard` — se usan tanto en `ComprasTab` (dentro del viaje) como en la página de Inventario global, sin tocar el modelo de datos.

**Tech Stack:** Next.js 16 (client components), Supabase (Postgres), Tailwind v4 tema neutro (oklch, sin colores saturados), lucide-react, `node --test` para los helpers puros.

**Referencia de spec:** `docs/superpowers/specs/2026-08-31-fases-dinamicas-y-vistas-inventario-design.md`

---

## Estructura de archivos

- **Modificar** `lib/viajeFases.mjs` — agregar `stepperState(fase)`.
- **Modificar** `tests/viaje-fases.test.mjs` — tests de `stepperState`.
- **Crear** `app/dashboard/_components/ViewToggle.js` — toggle Lista/Tarjetas + hook `useViewPreference` (persistencia en `localStorage`).
- **Crear** `app/dashboard/_components/ProductCard.js` — tarjeta compartida (Compras e Inventario).
- **Modificar** `app/globals.css` — estilos del stepper (nodos, línea, animación) y de `ProductCard`.
- **Modificar** `app/dashboard/viajes/[id]/page.js` — `FaseStepper`, `useFaseResumen` + `FaseResumen`, integrar `ViewToggle`/`ProductCard` en `ComprasTab`.
- **Modificar** `app/dashboard/inventario/page.js` — integrar `ViewToggle`/`ProductCard`.

---

## Task 1: Helper `stepperState()` + tests (TDD)

**Files:**
- Modify: `lib/viajeFases.mjs`
- Test: `tests/viaje-fases.test.mjs`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `tests/viaje-fases.test.mjs`:

```js
test('stepperState: en preparacion, ese paso está "current" y el resto "pending"', () => {
  const s = stepperState('preparacion');
  assert.deepEqual(s.map(x => x.status), ['current', 'pending', 'pending']);
});

test('stepperState: en en_curso, preparacion queda "done"', () => {
  const s = stepperState('en_curso');
  assert.deepEqual(s.map(x => x.status), ['done', 'current', 'pending']);
});

test('stepperState: en ventas, las dos fases previas quedan "done"', () => {
  const s = stepperState('ventas');
  assert.deepEqual(s.map(x => x.status), ['done', 'done', 'current']);
});

test('stepperState: cada paso incluye su código de fase y label de FASE_META', () => {
  const s = stepperState('preparacion');
  assert.deepEqual(s[0], { fase: 'preparacion', label: 'Preparación', status: 'current' });
  assert.deepEqual(s[1], { fase: 'en_curso', label: 'En curso', status: 'pending' });
  assert.deepEqual(s[2], { fase: 'ventas', label: 'Ventas', status: 'pending' });
});
```

Y agregar `stepperState` al import en la línea 3-5 del mismo archivo:

```js
import {
  FASES, FASE_META, faseIndex, faseAlcanzada, siguienteFase, avanceConfig, stepperState,
} from '../lib/viajeFases.mjs';
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: FALLA (`stepperState is not a function` o `undefined`).

- [ ] **Step 3: Implementar `stepperState`**

Agregar al final de `lib/viajeFases.mjs`:

```js
// Estado de cada fase para el stepper visual: 'done' | 'current' | 'pending'.
export function stepperState(fase) {
  const actual = faseIndex(fase);
  return FASES.map((f, i) => ({
    fase: f,
    label: FASE_META[f].label,
    status: i < actual ? 'done' : i === actual ? 'current' : 'pending',
  }));
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: PASS (11 tests, 0 fallos).

- [ ] **Step 5: Commit**

```bash
git add lib/viajeFases.mjs tests/viaje-fases.test.mjs
git commit -m "feat: helper stepperState para el indicador visual de fases"
```

---

## Task 2: CSS del stepper de fases

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Agregar los estilos del stepper**

En `app/globals.css`, insertar justo antes de la sección `/* ── Error box ───...` (antes de `.error-box {`):

```css
/* ── Fase stepper ────────────────────────────────────────── */
.fase-step-node {
  width:           24px;
  height:          24px;
  border-radius:   9999px;
  display:         flex;
  align-items:     center;
  justify-content: center;
  font-size:       0.75rem;
  flex-shrink:     0;
  border:          1px solid var(--border);
  color:           var(--text-muted);
  transition:      background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
}
.fase-step-current,
.fase-step-done {
  background:   var(--foreground);
  color:        var(--background);
  border-color: var(--foreground);
}
.fase-step-done   { animation: stepDone 0.2s ease; }
.fase-step-pending { opacity: 0.4; }

@keyframes stepDone {
  from { transform: scale(0.7); }
  to   { transform: scale(1); }
}

.fase-step-line {
  flex:       1;
  height:     2px;
  background: var(--border);
  margin:     0 10px;
  transition: background 0.3s ease;
}
.fase-step-line-done { background: var(--foreground); }
```

- [ ] **Step 2: Agregar los estilos de `ProductCard`**

En el mismo archivo, justo debajo del bloque del stepper que acabás de agregar:

```css
/* ── Product card (vista de tarjetas) ───────────────────── */
.product-card {
  position:      relative;
  border-radius: 12px;
  border:        1px solid var(--border);
  background:    var(--surface);
  padding:       0.75rem;
  overflow:      hidden;
  transition:    border-color 0.15s, box-shadow 0.15s;
}
.product-card:hover { border-color: var(--border-focus); }
.product-card-stripe {
  height:        4px;
  border-radius: 9999px;
  margin-bottom: 0.625rem;
}
.product-card-title {
  font-size:   0.8125rem;
  font-weight: 600;
  color:       var(--text);
  overflow:    hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-card-meta {
  font-size:  0.6875rem;
  color:      var(--text-muted);
  margin-top: 0.125rem;
}
.product-card-value {
  font-size:   0.875rem;
  font-weight: 700;
  color:       var(--text);
  margin-top:  0.375rem;
  font-variant-numeric: tabular-nums;
}
.product-card-actions {
  display:         flex;
  align-items:     center;
  justify-content: flex-end;
  gap:             0.125rem;
  margin-top:      0.5rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: CSS del stepper de fases y de la tarjeta de producto"
```

---

## Task 3: `FaseStepper` — reemplazar el indicador de fase

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Ajustar imports**

Reemplazar la línea 4 (imports de `lucide-react`):

```js
import { ArrowLeft, X, Pencil, ClipboardList, HardHat, Utensils, BedDouble, Fuel, Droplet, Truck, Tag } from 'lucide-react';
```

por (agrega `Check`):

```js
import { ArrowLeft, X, Pencil, Check, ClipboardList, HardHat, Utensils, BedDouble, Fuel, Droplet, Truck, Tag } from 'lucide-react';
```

Reemplazar la línea 5:

```js
import { FASES, FASE_META, faseIndex, avanceConfig } from '@/lib/viajeFases.mjs';
```

por (ya no se usan `FASES`/`FASE_META`/`faseIndex` directamente en este archivo — quedan encapsulados en `stepperState`):

```js
import { avanceConfig, stepperState } from '@/lib/viajeFases.mjs';
```

- [ ] **Step 2: Agregar el componente `FaseStepper`**

Insertar, justo antes del comentario `/* ── Main Page ──────────────────────────────────────────── */`:

```jsx
/* ── Stepper de fases ─────────────────────────────────────── */
function FaseStepper({ fase }) {
    const steps = stepperState(fase);
    return (
        <div className="flex items-center pb-3 border-b border-stone-200 dark:border-slate-700">
            {steps.map((s, i) => (
                <div key={s.fase} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`fase-step-node fase-step-${s.status}`}>
                            {s.status === 'done' ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <span className={`text-sm whitespace-nowrap ${
                            s.status === 'pending' ? 'text-stone-400 dark:text-slate-500' : 'text-foreground'
                        } ${s.status === 'current' ? 'font-medium' : ''}`}>
                            {s.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`fase-step-line ${s.status === 'done' ? 'fase-step-line-done' : ''}`} />
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Usar `FaseStepper` en `ViajeDetallePage`**

Reemplazar el bloque (la constante `pasoNum` y el indicador de fase):

```js
    const cfg      = avanceConfig(viaje.fase);
    const pasoNum  = faseIndex(viaje.fase) + 1;
```

por:

```js
    const cfg = avanceConfig(viaje.fase);
```

Y reemplazar el bloque JSX:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && (
                <div className="flex items-center gap-2 text-sm border-b border-stone-200 dark:border-slate-700 pb-3">
                    <span className="w-6 h-6 rounded-full bg-foreground text-background text-xs flex items-center justify-center shrink-0">{pasoNum}</span>
                    <span className="font-medium text-foreground">{FASE_META[viaje.fase].label}</span>
                    <span className="text-xs text-stone-400 dark:text-slate-500">Paso {pasoNum} de {FASES.length}</span>
                </div>
            )}
```

por:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && <FaseStepper fase={viaje.fase} />}
```

- [ ] **Step 4: Verificar que compila**

Con el dev server corriendo, run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: stepper de píldoras animado para el indicador de fase"
```

---

## Task 4: Resumen dinámico por fase

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Agregar el hook `useFaseResumen`**

Insertar, justo antes del comentario `/* ── Stepper de fases ─────...` agregado en la Task 3:

```jsx
/* ── Resumen dinámico de la fase actual ─────────────────────
   Trae mini-stats livianas (counts/sumas) específicas de la
   fase activa del viaje, independientes de lo que cargan los
   tabs (no duplica su lógica de UI, solo trae los números). */
function useFaseResumen(viaje, refreshKey) {
    const [resumen, setResumen] = useState(null);
    const viajeId = viaje?.id;
    const fase = viaje?.fase;
    const fechaInicio = viaje?.fecha_inicio;

    const load = useCallback(async () => {
        if (!viajeId || !fase) return;
        setResumen(null);

        if (fase === 'preparacion') {
            const [cR, dR] = await Promise.all([
                supabase.from('compras').select('cantidad,precio_unitario, viaje_divisas(tasa)').eq('viaje_id', viajeId),
                supabase.from('viaje_divisas').select('id', { count: 'exact', head: true }).eq('viaje_id', viajeId),
            ]);
            const compras = cR.data ?? [];
            const total = compras.reduce((s, i) => s + montoUsd(i.cantidad, i.precio_unitario, i.viaje_divisas?.tasa ?? 1), 0);
            setResumen({
                items: [
                    { label: 'Compras', value: String(compras.length) },
                    { label: 'Gastado', value: `$${fmt(total)}` },
                    { label: 'Divisas', value: String(dR.count ?? 0) },
                ],
            });
        } else if (fase === 'en_curso') {
            const { data } = await supabase.from('costos_adicionales').select('monto, viaje_divisas(tasa)').eq('viaje_id', viajeId);
            const costos = data ?? [];
            const total = costos.reduce((s, i) => s + montoUsd(1, i.monto, i.viaje_divisas?.tasa ?? 1), 0);
            const dias = fechaInicio
                ? Math.max(0, Math.floor((Date.now() - new Date(fechaInicio + 'T00:00:00').getTime()) / 86400000))
                : 0;
            setResumen({
                items: [
                    { label: 'Costos', value: String(costos.length) },
                    { label: 'Gastado', value: `$${fmt(total)}` },
                    { label: 'Días', value: String(dias) },
                ],
            });
        } else if (fase === 'ventas') {
            const { data } = await supabase.from('ventas').select('cantidad,precio_unitario,total_real').eq('viaje_id', viajeId);
            const ventas = data ?? [];
            const total = ventas.reduce((s, i) => s + ventaTotal(i.cantidad, i.precio_unitario, i.total_real), 0);
            setResumen({
                items: [
                    { label: 'Ventas', value: String(ventas.length) },
                    { label: 'Vendido', value: `$${fmt(total)}` },
                ],
            });
        }
    }, [viajeId, fase, fechaInicio]);

    useEffect(() => { load(); }, [load, refreshKey]);

    return resumen;
}

/* ── Fila de mini-stats de la fase actual ───────────────────
   `resumen` es el valor devuelto por useFaseResumen (null = cargando). */
function FaseResumen({ fase, resumen }) {
    const count = fase === 'ventas' ? 2 : 3;
    const cols  = count === 2 ? 'grid-cols-2' : 'grid-cols-3';
    const items = resumen?.items ?? Array.from({ length: count }, () => null);

    return (
        <div className={`grid ${cols} gap-2.5`}>
            {items.map((it, i) => (
                <div key={it?.label ?? i} className="stat-tile">
                    {it ? (
                        <>
                            <p className="stat-label">{it.label}</p>
                            <p className="stat-value">{it.value}</p>
                        </>
                    ) : (
                        <>
                            <div className="skeleton h-3 w-12 mb-2" />
                            <div className="skeleton h-5 w-16" />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Usar el hook y el componente en `ViajeDetallePage`**

Reemplazar la línea (dentro de `ViajeDetallePage`, junto a los otros `useState`):

```js
    const [divisasVersion, setDivisasVersion] = useState(0);
```

por (agrega la llamada al hook justo después, antes de cualquier `return` temprano):

```js
    const [divisasVersion, setDivisasVersion] = useState(0);
    const resumenFase = useFaseResumen(viaje, divisasVersion);
```

Y reemplazar:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && <FaseStepper fase={viaje.fase} />}
```

por:

```jsx
            {/* Indicador de fase (una a la vez) */}
            {!isClosed && (
                <div className="space-y-3">
                    <FaseStepper fase={viaje.fase} />
                    <FaseResumen fase={viaje.fase} resumen={resumenFase} />
                </div>
            )}
```

- [ ] **Step 3: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.
Run: `tail -25 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined|unexpected" | grep -viE "fetching profile|set-state-in-effect"`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: resumen dinámico de mini-stats por fase del viaje"
```

---

## Task 5: `ViewToggle` + `useViewPreference` (componente compartido)

**Files:**
- Create: `app/dashboard/_components/ViewToggle.js`

- [ ] **Step 1: Crear el componente y el hook**

Create `app/dashboard/_components/ViewToggle.js`:

```jsx
'use client';
import { useEffect, useState } from 'react';
import { List, LayoutGrid } from 'lucide-react';

// Preferencia de vista (lista/tarjetas) persistida en localStorage,
// una clave por sección (ej. 'compras', 'inventario').
export function useViewPreference(key) {
    const [vista, setVistaState] = useState('lista');

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(`feria:vista:${key}`);
            if (saved === 'lista' || saved === 'tarjetas') setVistaState(saved);
        } catch {
            // localStorage no disponible (SSR o navegador restringido): queda en 'lista'.
        }
    }, [key]);

    function setVista(v) {
        setVistaState(v);
        try { window.localStorage.setItem(`feria:vista:${key}`, v); } catch { /* no-op */ }
    }

    return [vista, setVista];
}

export function ViewToggle({ value, onChange }) {
    return (
        <div className="inline-flex rounded-lg border border-border overflow-hidden shrink-0" role="group" aria-label="Cambiar vista">
            <button
                type="button"
                onClick={() => onChange('lista')}
                title="Vista de lista"
                className={`p-1.5 transition-colors ${value === 'lista' ? 'bg-foreground text-background' : 'text-stone-400 hover:text-foreground'}`}
            >
                <List className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => onChange('tarjetas')}
                title="Vista de tarjetas"
                className={`p-1.5 transition-colors border-l border-border ${value === 'tarjetas' ? 'bg-foreground text-background' : 'text-stone-400 hover:text-foreground'}`}
            >
                <LayoutGrid className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200` (el archivo nuevo no se usa todavía en esta tarea, así que no debería romper nada).

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/_components/ViewToggle.js
git commit -m "feat: componente ViewToggle + hook useViewPreference (localStorage)"
```

---

## Task 6: `ProductCard` (componente compartido)

**Files:**
- Create: `app/dashboard/_components/ProductCard.js`

- [ ] **Step 1: Crear el componente**

Create `app/dashboard/_components/ProductCard.js`:

```jsx
'use client';

// Franja de color rotando por índice (paleta neutra del tema, sin
// colores saturados) — marcador visual temporal hasta tener íconos.
function stripeStyle(index) {
    return { background: `var(--chart-${(index % 5) + 1})` };
}

// Tarjeta compartida por las vistas de "tarjetas" de Compras e Inventario.
// - title: nombre del producto (requerido)
// - meta: subtítulo opcional (ej. "50 kg")
// - value: monto destacado opcional (ej. "$120,00")
// - dimmed: atenúa la tarjeta (ej. producto inactivo)
// - actions: nodo con los controles de la tarjeta (editar/borrar, badge, etc.)
export default function ProductCard({ index = 0, title, meta, value, dimmed = false, actions }) {
    return (
        <div className={`product-card ${dimmed ? 'opacity-50' : ''}`}>
            <div className="product-card-stripe" style={stripeStyle(index)} />
            <p className={`product-card-title ${dimmed ? 'line-through' : ''}`}>{title}</p>
            {meta && <p className="product-card-meta">{meta}</p>}
            {value && <p className="product-card-value">{value}</p>}
            {actions && <div className="product-card-actions">{actions}</div>}
        </div>
    );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/_components/ProductCard.js
git commit -m "feat: componente ProductCard compartido para vistas de tarjetas"
```

---

## Task 7: Integrar `ViewToggle` + `ProductCard` en `ComprasTab`

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js`

- [ ] **Step 1: Importar los componentes compartidos**

Agregar debajo del import de `@/lib/divisas.mjs` (línea 6):

```js
import { ViewToggle, useViewPreference } from '@/app/dashboard/_components/ViewToggle';
import ProductCard from '@/app/dashboard/_components/ProductCard';
```

- [ ] **Step 2: Agregar el estado de vista en `ComprasTab`**

En `ComprasTab`, agregar junto a los demás `useState`/hooks (justo después de la línea `const { productos, reload: reloadProductos, userId } = useProductos();`):

```js
    const [vista, setVista] = useViewPreference('compras');
```

- [ ] **Step 3: Agregar el `ViewToggle` al header de la sección**

Reemplazar:

```jsx
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
```

por:

```jsx
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
                <ViewToggle value={vista} onChange={setVista} />
                {!readOnly && <AddButton onClick={() => showForm ? resetForm() : openForm()} open={showForm} />}
            </SectionHeader>
```

- [ ] **Step 4: Extraer los datos de cada item a una función compartida**

Justo antes del `return (` de `ComprasTab` (después de la línea `const total = items.reduce((s, i) => s + costoItem(i), 0);`), agregar:

```js
    // Datos ya calculados de un item, usados tanto por la fila de lista como por la tarjeta.
    function itemView(i) {
        const d = i.viaje_divisas ?? { codigo: 'USD', tasa: 1, es_base: true };
        const precioUsd = montoUsd(1, i.precio_unitario, d.tasa);
        const esKg = i.unidad === 'kg';
        const costoPorKg = esKg ? costoFinalPorKg(precioUsd, tasaNum) : precioUsd;
        const sub = Number(i.cantidad) * costoPorKg;
        const trasladoExtra = esKg && tasaNum > 0;
        const line = `${i.cantidad} ${i.unidad} × $${fmt(costoPorKg)}/kg${trasladoExtra ? ` ($${fmt(precioUsd)} + $${fmt(tasaNum)} traslado)` : ''} = $${fmt(sub)}`;
        return { sub, line };
    }
```

- [ ] **Step 5: Simplificar el `.map` de la lista para usar `itemView`**

Reemplazar el bloque `.map` dentro de `<div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">`:

```jsx
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
```

por (branch de lista y de tarjetas, ambos usando `itemView`):

```jsx
            {loading ? (
                <div className="rounded-xl border border-border bg-muted p-2.5"><Spinner /></div>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted p-2.5"><EmptyState msg="Sin compras registradas. Agrega la primera." /></div>
            ) : vista === 'tarjetas' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {items.map((i, idx) => {
                        const { sub } = itemView(i);
                        return (
                            <ProductCard key={i.id}
                                index={idx}
                                title={i.producto}
                                meta={`${i.cantidad} ${i.unidad}`}
                                value={`$${fmt(sub)}`}
                                actions={!readOnly && (
                                    <>
                                        <EditBtn onClick={() => startEdit(i)} />
                                        <DeleteBtn onClick={() => del(i.id)} />
                                    </>
                                )}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-xl border border-border bg-muted p-2.5 space-y-2.5">
                    {items.map(i => {
                        const { line } = itemView(i);
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
                    })}
                </div>
            )}
```

- [ ] **Step 6: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200`.
Run: `tail -25 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined|unexpected" | grep -viE "fetching profile|set-state-in-effect"`
Expected: sin salida.

- [ ] **Step 7: Verificación manual**

Con el dev server corriendo: entrar a un viaje en fase Preparación → sección Compras → click en el ícono de grilla del `ViewToggle` → confirmar que se ve la grilla de tarjetas con el mismo monto/cantidad que mostraba la lista, y que editar/borrar funcionan igual desde la tarjeta. Recargar la página y confirmar que la vista elegida persiste (viene de `localStorage`).

- [ ] **Step 8: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: vista de tarjetas en Compras del viaje (toggle lista/tarjetas)"
```

---

## Task 8: Integrar `ViewToggle` + `ProductCard` en Inventario global

**Files:**
- Modify: `app/dashboard/inventario/page.js`

- [ ] **Step 1: Importar los componentes compartidos**

Agregar en `app/dashboard/inventario/page.js`, debajo del import de `@/context/AuthContext`:

```js
import { ViewToggle, useViewPreference } from '@/app/dashboard/_components/ViewToggle';
import ProductCard from '@/app/dashboard/_components/ProductCard';
```

- [ ] **Step 2: Agregar el estado de vista**

Dentro de `InventarioPage`, agregar junto a los demás `useState` (después de `const [error, setError] = useState('');`):

```js
    const [vista, setVista] = useViewPreference('inventario');
```

- [ ] **Step 3: Agregar el `ViewToggle` junto al botón de "+ Nuevo item"**

Reemplazar:

```jsx
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100">Inventario</h1>
                <button
                    onClick={() => { setShowForm(s => !s); setError(''); }}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors border-foreground/30 text-foreground hover:bg-muted"
                >
                    {showForm ? 'Cancelar' : '+ Nuevo item'}
                </button>
            </div>
```

por:

```jsx
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-stone-900 dark:text-slate-100">Inventario</h1>
                <div className="flex items-center gap-2">
                    <ViewToggle value={vista} onChange={setVista} />
                    <button
                        onClick={() => { setShowForm(s => !s); setError(''); }}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors border-foreground/30 text-foreground hover:bg-muted"
                    >
                        {showForm ? 'Cancelar' : '+ Nuevo item'}
                    </button>
                </div>
            </div>
```

- [ ] **Step 4: Renderizar tarjetas cuando `vista === 'tarjetas'`**

Reemplazar el bloque final:

```jsx
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="py-10 flex justify-center">
                        <div className="w-6 h-6 rounded-full border-[3px] border-stone-200 border-t-foreground animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-stone-400 dark:text-slate-500 text-sm">
                            Sin items todavía. Crea el primero para usarlo en tus viajes.
                        </p>
                    </div>
                ) : (
                    items.map(item => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-3 px-4 border-b border-stone-100 dark:border-slate-700 last:border-0"
                        >
                            <p className={`text-sm font-medium ${item.activo ? 'text-stone-800 dark:text-slate-200' : 'text-stone-400 dark:text-slate-500 line-through'}`}>
                                {item.nombre}
                            </p>
                            <button
                                onClick={() => toggleActivo(item)}
                                className={`shrink-0 badge text-xs ${item.activo ? 'badge-blue' : 'badge-gray'}`}
                                title={item.activo ? 'Desactivar' : 'Activar'}
                            >
                                {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                        </div>
                    ))
                )}
            </div>
```

por:

```jsx
            {loading ? (
                <div className="card p-0 overflow-hidden py-10 flex justify-center">
                    <div className="w-6 h-6 rounded-full border-[3px] border-stone-200 border-t-foreground animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <div className="card p-0 overflow-hidden py-12 text-center">
                    <p className="text-stone-400 dark:text-slate-500 text-sm">
                        Sin items todavía. Crea el primero para usarlo en tus viajes.
                    </p>
                </div>
            ) : vista === 'tarjetas' ? (
                <div className="grid grid-cols-2 gap-2.5">
                    {items.map((item, idx) => (
                        <ProductCard key={item.id}
                            index={idx}
                            title={item.nombre}
                            dimmed={!item.activo}
                            actions={(
                                <button
                                    onClick={() => toggleActivo(item)}
                                    className={`badge text-xs ${item.activo ? 'badge-blue' : 'badge-gray'}`}
                                    title={item.activo ? 'Desactivar' : 'Activar'}
                                >
                                    {item.activo ? 'Activo' : 'Inactivo'}
                                </button>
                            )}
                        />
                    ))}
                </div>
            ) : (
                <div className="card p-0 overflow-hidden">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-3 px-4 border-b border-stone-100 dark:border-slate-700 last:border-0"
                        >
                            <p className={`text-sm font-medium ${item.activo ? 'text-stone-800 dark:text-slate-200' : 'text-stone-400 dark:text-slate-500 line-through'}`}>
                                {item.nombre}
                            </p>
                            <button
                                onClick={() => toggleActivo(item)}
                                className={`shrink-0 badge text-xs ${item.activo ? 'badge-blue' : 'badge-gray'}`}
                                title={item.activo ? 'Desactivar' : 'Activar'}
                            >
                                {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
```

- [ ] **Step 5: Verificar que compila**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard/inventario`
Expected: `200`.
Run: `tail -25 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined|unexpected" | grep -viE "fetching profile|set-state-in-effect"`
Expected: sin salida.

- [ ] **Step 6: Verificación manual**

Entrar a `/dashboard/inventario` → click en el ícono de grilla → confirmar que se ven las tarjetas con nombre y badge Activo/Inactivo, que el toggle de activar/desactivar sigue funcionando desde la tarjeta, y que la preferencia de vista persiste al recargar (clave `localStorage` distinta a la de Compras, así que pueden quedar en modos distintos).

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/inventario/page.js
git commit -m "feat: vista de tarjetas en Inventario global (toggle lista/tarjetas)"
```

---

## Task 9: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr toda la suite de tests unitarios**

Run: `node --test tests/*.test.mjs`
Expected: todos los tests PASS, incluidos los 4 nuevos de `stepperState`.

- [ ] **Step 2: Verificación manual end-to-end del flujo**

Con el dev server corriendo, y credenciales de un usuario de prueba:
1. Crear (o abrir) un viaje en Preparación → confirmar que se ve el stepper de píldoras con "Preparación" resaltada y las otras dos atenuadas, más la fila de mini-stats (Compras/Gastado/Divisas) debajo.
2. Registrar una compra → confirmar que las mini-stats se actualizan (count y monto).
3. Cambiar a vista de tarjetas en Compras, confirmar el layout y que editar/borrar funcionan.
4. Avanzar de fase ("Iniciar viaje") → confirmar que el nodo de Preparación anima su check, la línea se rellena, y las mini-stats cambian a las de "En curso" (Costos/Gastado/Días).
5. Ir a `/dashboard/inventario`, cambiar a vista de tarjetas, confirmar que persiste al recargar.

- [ ] **Step 3: Actualizar el checklist de la spec (opcional pero recomendado)**

No es necesario un commit adicional — si se detectó algún ajuste menor durante la verificación manual, corregirlo y hacer un commit de fix puntual con `git commit -m "fix: ..."` antes de dar por cerrado el ciclo.

---

## Self-review (cobertura del spec)

- **Stepper de fases con transición animada, solo lectura** — Task 1 (`stepperState`) + Task 2 (CSS) + Task 3 (`FaseStepper`). ✓
- **Resumen dinámico por fase** — Task 4 (`useFaseResumen` + `FaseResumen`), stats según la tabla de la spec (preparación/en_curso/ventas). ✓
- **Toggle Lista/Tarjetas + persistencia en localStorage** — Task 5 (`ViewToggle`/`useViewPreference`). ✓
- **Tarjeta compartida sin categorías/íconos, franja de color por índice** — Task 6 (`ProductCard`, usa `--chart-1..5` del tema neutro, no colores saturados). ✓
- **Aplicado a Compras del viaje** — Task 7. ✓
- **Aplicado a Inventario global** — Task 8. ✓
- **Sin cambios al modelo de datos, sin migración de framework** — ningún task toca `supabase/schema.sql` ni agrega dependencias nuevas. ✓
