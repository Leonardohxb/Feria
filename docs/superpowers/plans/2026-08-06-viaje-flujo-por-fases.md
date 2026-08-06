# Flujo del viaje por fases — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el detalle del viaje en un flujo guiado de 3 fases (Preparación → En curso → Ventas) que oculta las ventas hasta la fase final, con avance confirmado y retroceso de solo-vista.

**Architecture:** Se agrega `viajes.fase` (fase máxima alcanzada). La lógica pura de fases vive en un módulo aislado y testeado (`lib/viajeFases.mjs`). El detalle del viaje (`app/dashboard/viajes/[id]/page.js`) reemplaza sus pestañas por un stepper que muestra las secciones según la fase activa (`activeStep`), con botones de avance confirmados. Las tabs internas (Compras/Ventas/Costos/Resumen) no cambian.

**Tech Stack:** Next.js 16 (App Router, client components), Supabase (Postgres + RLS), Tailwind v4 + tema neutro shadcn, lucide-react. Tests: `node --test` (built-in) para lógica pura, Playwright para e2e.

**Referencia de spec:** `docs/superpowers/specs/2026-08-06-viaje-flujo-por-fases-design.md`

---

## Estructura de archivos

- **Crear** `lib/viajeFases.mjs` — lógica pura de fases (orden, metadatos, transiciones, config de avance). ESM `.mjs` para que sea importable tanto por Next como por `node --test` sin configuración extra.
- **Crear** `tests/viaje-fases.test.mjs` — tests unitarios de la lógica pura con `node:test`.
- **Crear** `supabase/migrations/003_viaje_fase.sql` — migración que agrega la columna `fase`.
- **Modificar** `supabase/schema.sql` — agregar `fase` a la definición de `viajes` (schema fuente).
- **Modificar** `app/dashboard/viajes/[id]/page.js` — reemplazar tabs por stepper de fases, gating de secciones, avance confirmado, mover "Cerrar viaje" a la fase Ventas.
- **Modificar** `tests/feria-e2e.spec.js` — actualizar `runDashboardTests` al flujo por fases (el actual asume las 4 tabs visibles).

---

## Task 1: Migración — agregar `fase` a `viajes`

**Files:**
- Create: `supabase/migrations/003_viaje_fase.sql`
- Modify: `supabase/schema.sql` (tabla `viajes`)

- [ ] **Step 1: Escribir la migración**

Create `supabase/migrations/003_viaje_fase.sql`:

```sql
-- ============================================================
-- MIGRACIÓN: agrega la fase del viaje (flujo guiado)
--   preparacion → en_curso → ventas (fase máxima alcanzada)
-- Ejecutar en: Supabase Dashboard > SQL Editor, o vía MCP.
-- ============================================================

ALTER TABLE public.viajes
  ADD COLUMN IF NOT EXISTS fase TEXT NOT NULL DEFAULT 'preparacion'
  CHECK (fase IN ('preparacion', 'en_curso', 'ventas'));

COMMENT ON COLUMN public.viajes.fase IS 'Fase máxima alcanzada del flujo guiado: preparacion, en_curso, ventas.';

-- Viajes existentes (previos a las fases): llevarlos a la fase final
-- para no ocultarles secciones ni datos ya cargados.
UPDATE public.viajes SET fase = 'ventas' WHERE fase = 'preparacion';
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía Supabase MCP con la herramienta `apply_migration` (name: `viaje_fase`, query: el contenido del `.sql` de arriba). Alternativa sin MCP: pegar el SQL en Supabase Dashboard → SQL Editor → Run.

- [ ] **Step 3: Verificar que la columna existe**

Ejecutar vía MCP `execute_sql` (o en el SQL Editor):

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'viajes' AND column_name = 'fase';
```

Expected: una fila con `fase | text | 'preparacion'::text`.

- [ ] **Step 4: Reflejar la columna en el schema fuente**

En `supabase/schema.sql`, dentro del `CREATE TABLE IF NOT EXISTS public.viajes (...)`, agregar la columna `fase` justo después de la línea de `estado`:

```sql
  estado       TEXT  NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
  fase         TEXT  NOT NULL DEFAULT 'preparacion' CHECK (fase IN ('preparacion', 'en_curso', 'ventas')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

(Reemplaza el bloque de esas tres líneas manteniendo la indentación existente.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_viaje_fase.sql supabase/schema.sql
git commit -m "feat(db): agrega columna fase a viajes (flujo por fases)"
```

---

## Task 2: Lógica pura de fases + tests unitarios (TDD)

**Files:**
- Create: `lib/viajeFases.mjs`
- Test: `tests/viaje-fases.test.mjs`

- [ ] **Step 1: Escribir el test que falla**

Create `tests/viaje-fases.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FASES, FASE_META, faseIndex, faseAlcanzada, siguienteFase, avanceConfig,
} from '../lib/viajeFases.mjs';

test('FASES define el orden preparacion → en_curso → ventas', () => {
  assert.deepEqual(FASES, ['preparacion', 'en_curso', 'ventas']);
});

test('faseIndex devuelve el índice, o -1 si no existe', () => {
  assert.equal(faseIndex('preparacion'), 0);
  assert.equal(faseIndex('ventas'), 2);
  assert.equal(faseIndex('inexistente'), -1);
});

test('faseAlcanzada: un paso está alcanzado si su índice <= la fase máxima', () => {
  assert.equal(faseAlcanzada('preparacion', 'en_curso'), true);
  assert.equal(faseAlcanzada('en_curso', 'en_curso'), true);
  assert.equal(faseAlcanzada('ventas', 'en_curso'), false);
  assert.equal(faseAlcanzada('ventas', 'ventas'), true);
});

test('siguienteFase devuelve la próxima fase, o null en la última', () => {
  assert.equal(siguienteFase('preparacion'), 'en_curso');
  assert.equal(siguienteFase('en_curso'), 'ventas');
  assert.equal(siguienteFase('ventas'), null);
});

test('avanceConfig da la config del botón de avance, o null en ventas', () => {
  assert.equal(avanceConfig('preparacion').next, 'en_curso');
  assert.equal(avanceConfig('preparacion').label, 'Iniciar viaje');
  assert.match(avanceConfig('preparacion').confirm, /listo para empezar/i);
  assert.equal(avanceConfig('en_curso').next, 'ventas');
  assert.equal(avanceConfig('en_curso').label, 'Registrar ventas');
  assert.equal(avanceConfig('ventas'), null);
});

test('FASE_META mapea cada fase a su etiqueta y secciones', () => {
  assert.equal(FASE_META.preparacion.label, 'Preparación');
  assert.deepEqual(FASE_META.preparacion.secciones, ['compras', 'costos']);
  assert.deepEqual(FASE_META.en_curso.secciones, ['costos']);
  assert.deepEqual(FASE_META.ventas.secciones, ['ventas']);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: FALLA con `Cannot find module '.../lib/viajeFases.mjs'` (el módulo aún no existe).

- [ ] **Step 3: Implementar el módulo mínimo**

Create `lib/viajeFases.mjs`:

```js
// Lógica pura del flujo por fases del viaje.
// Importable por Next (app) y por node --test (unit) sin configuración extra.

export const FASES = ['preparacion', 'en_curso', 'ventas'];

export const FASE_META = {
  preparacion: { label: 'Preparación', secciones: ['compras', 'costos'] },
  en_curso:    { label: 'En curso',    secciones: ['costos'] },
  ventas:      { label: 'Ventas',      secciones: ['ventas'] },
};

export function faseIndex(fase) {
  return FASES.indexOf(fase);
}

// ¿El paso `step` ya fue alcanzado dado el máximo `faseMax`?
export function faseAlcanzada(step, faseMax) {
  const i = faseIndex(step);
  const m = faseIndex(faseMax);
  return i >= 0 && m >= 0 && i <= m;
}

// Próxima fase, o null si ya es la última.
export function siguienteFase(fase) {
  const i = faseIndex(fase);
  return i >= 0 && i < FASES.length - 1 ? FASES[i + 1] : null;
}

// Config del botón de avance para la fase punta actual.
// En 'ventas' devuelve null: ahí el avance es "Cerrar viaje" (manejado aparte).
export function avanceConfig(fase) {
  if (fase === 'preparacion') return {
    next: 'en_curso',
    label: 'Iniciar viaje',
    confirm: '¿Ya estás listo para empezar el viaje? Podrás volver a Preparación si necesitás corregir algo.',
  };
  if (fase === 'en_curso') return {
    next: 'ventas',
    label: 'Registrar ventas',
    confirm: '¿Pasar a registrar las ventas? Podrás volver a fases anteriores si hace falta.',
  };
  return null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test tests/viaje-fases.test.mjs`
Expected: PASS (6 tests, 0 fallos).

- [ ] **Step 5: Commit**

```bash
git add lib/viajeFases.mjs tests/viaje-fases.test.mjs
git commit -m "feat: lógica pura de fases del viaje + tests unitarios"
```

---

## Task 3: Detalle del viaje con stepper de fases

**Files:**
- Modify: `app/dashboard/viajes/[id]/page.js` (solo la función `ViajeDetallePage` al final del archivo, ~línea 603 en adelante, y la línea de imports)

Las tabs internas (`ComprasTab`, `VentasTab`, `CostosTab`, `ResumenTab`) y los helpers superiores **no cambian**.

- [ ] **Step 1: Importar la lógica de fases**

En `app/dashboard/viajes/[id]/page.js`, agregar el import de las fases junto a los imports existentes (debajo del import de lucide-react):

```js
import { FASES, FASE_META, faseAlcanzada, avanceConfig } from '@/lib/viajeFases.mjs';
```

- [ ] **Step 2: Reemplazar la función `ViajeDetallePage` completa**

Reemplazar toda la función `export default function ViajeDetallePage() { ... }` (desde `export default function ViajeDetallePage()` hasta su `}` de cierre al final del archivo) por:

```jsx
export default function ViajeDetallePage() {
    const { id }  = useParams();
    const router  = useRouter();
    const [viaje,      setViaje]      = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [activeStep, setActiveStep] = useState('preparacion');
    const [advancing,  setAdvancing]  = useState(false);
    const [closing,    setClosing]    = useState(false);

    useEffect(() => {
        supabase.from('viajes').select('*').eq('id', id).single()
            .then(({ data }) => {
                setViaje(data);
                setActiveStep(data?.fase ?? 'preparacion');
                setLoading(false);
            });
    }, [id]);

    async function handleAvanzar() {
        const cfg = avanceConfig(viaje.fase);
        if (!cfg) return;
        if (!confirm(cfg.confirm)) return;
        setAdvancing(true);
        await supabase.from('viajes').update({ fase: cfg.next }).eq('id', id);
        setViaje(v => ({ ...v, fase: cfg.next }));
        setActiveStep(cfg.next);
        setAdvancing(false);
    }

    async function handleCerrar() {
        if (!confirm('¿Cerrar este viaje? No podrás agregar más registros.')) return;
        setClosing(true);
        const fecha_fin = today();
        await supabase.from('viajes').update({ estado: 'cerrado', fecha_fin }).eq('id', id);
        setViaje(v => ({ ...v, estado: 'cerrado', fecha_fin }));
        setClosing(false);
        setActiveStep('resumen');
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
    const cfg      = avanceConfig(viaje.fase);
    const enPunta  = activeStep === viaje.fase;

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

            {/* Stepper de fases + acceso a Resumen */}
            <div className="flex items-center gap-0 border-b border-stone-200 dark:border-slate-700 overflow-x-auto">
                {FASES.map((f, i) => {
                    const reached = faseAlcanzada(f, viaje.fase);
                    const active  = activeStep === f;
                    return (
                        <button
                            key={f}
                            disabled={!reached}
                            onClick={() => reached && setActiveStep(f)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                active
                                    ? 'border-foreground text-foreground'
                                    : reached
                                        ? 'border-transparent text-stone-500 dark:text-slate-400 hover:text-foreground'
                                        : 'border-transparent text-stone-300 dark:text-slate-600 cursor-not-allowed'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded-full text-[0.7rem] flex items-center justify-center ${
                                active ? 'bg-foreground text-background' : reached ? 'bg-muted text-foreground' : 'bg-muted text-stone-400 dark:text-slate-600'
                            }`}>
                                {i + 1}
                            </span>
                            {FASE_META[f].label}
                        </button>
                    );
                })}
                <div className="flex-1 min-w-2" />
                <button
                    onClick={() => setActiveStep('resumen')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeStep === 'resumen'
                            ? 'border-foreground text-foreground'
                            : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-foreground'
                    }`}
                >
                    Resumen
                </button>
            </div>

            {/* Secciones según la fase activa */}
            {activeStep === 'preparacion' && (
                <div className="space-y-4">
                    <ComprasTab viajeId={id} readOnly={isClosed} />
                    <CostosTab  viajeId={id} readOnly={isClosed} />
                </div>
            )}
            {activeStep === 'en_curso' && <CostosTab  viajeId={id} readOnly={isClosed} />}
            {activeStep === 'ventas'   && <VentasTab  viajeId={id} readOnly={isClosed} />}
            {activeStep === 'resumen'  && <ResumenTab viajeId={id} />}

            {/* Acción de la fase punta (avanzar / cerrar) */}
            {!isClosed && enPunta && cfg && (
                <button onClick={handleAvanzar} disabled={advancing} className="btn-primary">
                    {advancing ? 'Guardando...' : cfg.label}
                </button>
            )}
            {!isClosed && enPunta && viaje.fase === 'ventas' && (
                <button
                    onClick={handleCerrar}
                    disabled={closing}
                    className="btn-primary"
                >
                    {closing ? 'Cerrando...' : 'Cerrar viaje'}
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Verificar que compila**

Con el dev server corriendo (`npm run dev` en `http://localhost:3000`), correr:

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200` (sin errores de compilación; un 500 indicaría error de sintaxis/import).

Además revisar que no haya error en el log:
Run: `tail -20 ".next/dev/logs/next-development.log" | grep -iE "error|is not defined" | grep -v "fetching profile"`
Expected: sin salida (o solo el warning conocido de `set-state-in-effect`).

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/viajes/[id]/page.js"
git commit -m "feat: flujo por fases en el detalle del viaje (stepper + gating)"
```

---

## Task 4: Actualizar el e2e al flujo por fases

**Files:**
- Modify: `tests/feria-e2e.spec.js` (la función `runDashboardTests`, sección "Voyage Management Flow", ~líneas 155-238)

El e2e actual asume las 4 tabs visibles desde el inicio y navega Ventas directo — con el gating eso falla. Hay que: verificar que Ventas NO está en preparación, cargar compras+costos, avanzar (con diálogos de confirmación), y recién ahí registrar ventas.

- [ ] **Step 1: Reemplazar el bloque de verificación de tabs y el flujo de compras/ventas/costos**

En `tests/feria-e2e.spec.js`, reemplazar desde el comentario `// Check Tabs are present` (línea ~157) hasta el final del bloque de Costos (justo antes de `// 7. Resumen (Summary) Checking`, línea ~206) por:

```js
    // Fase 1 — Preparación: se ven Compras y Costos; Ventas NO (gated).
    await expect(page.locator('button:has-text("Preparación")')).toBeVisible();
    await expect(page.locator('button:has-text("Compras")')).toBeVisible();
    await expect(page.locator('button:has-text("Resumen")')).toBeVisible();
    // El paso "Ventas" del stepper existe pero está deshabilitado en preparación.
    await expect(page.locator('button:has-text("Ventas")[disabled]')).toBeVisible();

    // Compras (Purchases) CRUD — visibles en Preparación
    await page.click('button:has-text("Agregar")');
    await page.selectOption('select', { label: 'Tomate E2E' });
    await page.fill('input[placeholder="Cantidad"]', '10');
    await page.fill('input[placeholder="Precio por unidad ($)"]', '5');
    await page.click('button:has-text("Guardar compra")');
    await expect(page.locator('text=10 kg × $5,00 = $50,00')).toBeVisible();

    // Editar la compra (10 → 20, total $100.00)
    await page.hover('text=Tomate E2E');
    await page.click('button[title="Editar"]');
    await page.fill('input[placeholder="Cantidad"]', '20');
    await page.click('button:has-text("Guardar cambios")');
    await expect(page.locator('text=20 kg × $5,00 = $100,00')).toBeVisible();

    // Costos CRUD — también en Preparación (segunda tarjeta de la vista)
    await page.locator('button:has-text("Agregar")').last().click();
    await page.selectOption('select', 'obreros');
    await page.fill('input[placeholder="Descripción"]', 'Pago cargadores');
    await page.fill('input[placeholder="Monto ($)"]', '10');
    await page.click('button:has-text("Guardar costo")');
    await expect(page.locator('text=Pago cargadores')).toBeVisible();

    // Avanzar: Preparación → En curso (diálogo de confirmación)
    page.once('dialog', async dialog => {
        expect(dialog.message()).toMatch(/listo para empezar/i);
        await dialog.accept();
    });
    await page.click('button:has-text("Iniciar viaje")');

    // Avanzar: En curso → Ventas (diálogo de confirmación)
    page.once('dialog', async dialog => {
        expect(dialog.message()).toMatch(/registrar las ventas/i);
        await dialog.accept();
    });
    await page.click('button:has-text("Registrar ventas")');

    // Fase 3 — Ventas: ahora sí se registran las ventas
    await expect(page.locator('button:has-text("Agregar")')).toBeVisible();
    await page.click('button:has-text("Agregar")');
    await page.selectOption('select', { label: 'Tomate E2E' });
    await page.fill('input[placeholder="Cantidad"]', '15');
    await page.fill('input[placeholder="Precio por unidad ($)"]', '8');
    await page.click('button:has-text("Guardar venta")');
    await expect(page.locator('text=15 kg × $8,00 = $120,00')).toBeVisible();
```

- [ ] **Step 2: Ajustar el cierre del viaje al nuevo lugar del botón**

El botón "Cerrar viaje" ahora vive en la fase Ventas (no en el header). En el bloque `// 8. Close voyage`, antes de hacer click en "Cerrar viaje", asegurar que el paso Ventas está activo. Reemplazar el bloque `// 8. Close voyage` (líneas ~225-238) por:

```js
    // 8. Cerrar viaje — el botón está en la fase Ventas
    await page.locator('button:has-text("Ventas")').first().click(); // volver al paso Ventas del stepper
    page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('¿Cerrar este viaje?');
        await dialog.accept();
    });
    await page.click('button:has-text("Cerrar viaje")');

    // Cerrado: badge gris "Cerrado"
    await expect(page.locator('span.badge:has-text("Cerrado")')).toBeVisible();

    // En modo readOnly ya no hay botón "Agregar" en las secciones
    await expect(page.locator('button:has-text("Agregar")')).not.toBeVisible();
```

(La sección `// 7. Resumen (Summary) Checking` entre medio no cambia: sigue clickeando `button:has-text("Resumen")` y verificando los totales.)

- [ ] **Step 3: Correr el e2e (si hay credenciales de test)**

Run: `npx playwright test tests/feria-e2e.spec.js --project=chromium`
Expected: el test `E2E Dashboard & Voyage Flow` pasa si `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` están en `.env.local`; si no, se salta (`test.skip`) — lo cual es esperado. Los otros tests (login inválido, forgot password) deben pasar.

Si las credenciales están y el flujo pasa, el gating queda verificado end-to-end. Si se saltan, verificar manualmente: crear un viaje nuevo, confirmar que Ventas está deshabilitado, avanzar con los diálogos, registrar una venta, y cerrar.

- [ ] **Step 4: Commit**

```bash
git add tests/feria-e2e.spec.js
git commit -m "test: e2e del flujo por fases del viaje"
```

---

## Notas de implementación

- **Estado `fase` vs `estado`:** independientes. `fase` solo avanza (nunca retrocede); `estado='cerrado'` bloquea todo a solo lectura. El retroceso en el stepper cambia `activeStep` (vista), no `fase`.
- **Costos en dos fases:** `CostosTab` es la misma lista acumulativa; aparece en Preparación y En curso a propósito (decisión del dueño).
- **Botón de avance:** solo visible cuando estás parado en la fase punta (`activeStep === viaje.fase`) y el viaje está activo. En Ventas el "avance" es "Cerrar viaje".
- **Badge "Activo":** sigue usando `badge-blue` (ya neutralizado por el tema a un gris secundario); no es azul visualmente.

## Self-review (cobertura del spec)

- Columna `fase` + migración de existentes a `ventas` → Task 1. ✓
- Gating estricto por fase (Compras+Costos / Costos / Ventas) → Task 3, render por `activeStep`. ✓
- Resumen siempre accesible → Task 3, botón de Resumen fijo. ✓
- Avance con advertencia de confirmación (no bloqueo) → Task 2 (`avanceConfig.confirm`) + Task 3 (`handleAvanzar`). ✓
- Retroceso de solo-vista → Task 3, stepper cambia `activeStep`, no `fase`. ✓
- Cerrar viaje en fase Ventas, bloquea a readOnly → Task 3 (`handleCerrar` en la punta Ventas). ✓
- Viajes migrados navegables sin ocultar datos → Task 1 (`UPDATE ... SET fase='ventas'`). ✓
- e2e existente actualizado al nuevo flujo → Task 4. ✓
