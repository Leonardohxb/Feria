# Fases dinámicas + vistas Lista/Tarjetas — Spec de Diseño

**Fecha:** 2026-08-31

**Contexto:** El detalle del viaje (`app/dashboard/viajes/[id]/page.js`) ya muestra una fase a la vez (sin stepper de pasos con navegación libre — ver spec previa `2026-08-06-viaje-flujo-por-fases-design.md`), pero el indicador de fase es una línea de texto plana (`① Preparación · Paso 1 de 3`) y las secciones de items (Compras, Costos, Ventas, Inventario) son siempre listas de filas. Esta spec cubre:

1. Un indicador de fase visual (stepper de píldoras) con transición animada al avanzar.
2. Un resumen dinámico de progreso específico de cada fase.
3. Una vista alternativa de tarjetas (además de la lista actual) para Compras del viaje y para el catálogo global de Inventario, con un toggle para elegir entre ambas.

**Fuera de alcance:** categorías/tabs de filtro sobre productos (no se agrega campo `categoria` a la tabla `productos`), íconos ilustrados por producto (se deja para un ciclo futuro — por ahora la tarjeta usa una franja de color rotando por índice), y cualquier cambio al framework (Next.js se mantiene).

---

## 1. Stepper de fases

Reemplaza el indicador de línea única en `ViajeDetallePage` (líneas 1080-1087 actuales) por un componente `FaseStepper` con 3 nodos conectados horizontalmente, uno por fase (`preparacion`, `en_curso`, `ventas`):

- **Completada:** círculo relleno (`bg-foreground` o un verde de acento — a definir en implementación siguiendo la paleta existente de `badge-blue`/`stat-green`), ✓ en vez de número, línea de conexión a la derecha coloreada/rellena.
- **Actual:** círculo con el número de paso, resaltado con el mismo estilo que ya usa el indicador actual (`bg-foreground text-background`), label en negrita.
- **Futura:** círculo vacío/con borde, `opacity-40`, label en gris (`text-stone-400 dark:text-slate-500`).

No se agrega navegación hacia fases futuras ni pasadas haciendo click en el stepper — sigue siendo de solo lectura, el avance ocurre únicamente vía el botón "Iniciar viaje"/"Registrar ventas" existente. Esto preserva la decisión de la spec previa de "sin retroceso/sin salto libre".

**Fuente de la verdad:** un helper puro nuevo en `lib/viajeFases.mjs`:

```js
// Devuelve las 3 fases con su estado ('done' | 'current' | 'pending') dado la fase actual.
export function stepperState(fase) { ... }
```

Testeado en `tests/viajeFases.test.mjs` (archivo ya existente, se agregan casos).

**Animación al avanzar:** cuando `handleAvanzar()` actualiza `viaje.fase`, el nodo que pasa a completado anima su aparición de check (~200ms, CSS `@keyframes` + `transition`, sin librerías nuevas) y la línea de conexión hace una transición de color. El contenido de la fase entrante sigue usando `animate-fade-in` (ya existente en `globals.css`).

## 2. Resumen dinámico por fase

Debajo del stepper, una fila de mini-stats (reutilizando visualmente el patrón `stat-tile` que ya existe en `ResumenTab`) específica de la fase activa:

| Fase | Stats mostrados |
|---|---|
| `preparacion` | compras registradas (count) · total gastado en compras (USD) · divisas configuradas (count) |
| `en_curso` | costos registrados (count) · total gastado en costos (USD) · días transcurridos desde `fecha_inicio` |
| `ventas` | ventas registradas (count) · total vendido (USD) |

Implementado con un hook `useFaseResumen(viaje)` en `ViajeDetallePage` que hace queries `select` con `count`/agregación liviana (no recalcula todo lo que ya cargan los tabs — son queries chicas, ejecutadas en paralelo, independientes de la lógica de UI de cada tab). No se persiste nada nuevo en la base de datos.

Si una query falla o tarda, el resumen muestra un skeleton (ya existe la clase de skeleton en `globals.css`) — nunca bloquea el render del resto de la fase.

## 3. Vista Lista ⇄ Tarjetas

Aplica a dos lugares, cada uno con su propio estado de vista:

- **Compras** dentro del detalle del viaje (fase Preparación).
- **Inventario** (`/dashboard/inventario`, catálogo global de productos).

### Componentes compartidos (nuevos)
- `ViewToggle` — botón doble (`☰ Lista` / `▦ Tarjetas`), controla el modo activo.
- `ProductCard` — tarjeta usada en ambas vistas de tarjetas: franja de color superior (paleta fija de ~6 colores, asignada por `index % 6` — determinística, no aleatoria, para que el mismo producto no cambie de color entre renders), nombre, monto destacado (precio total o precio unitario según el contexto — igual al dato que ya muestra la fila de lista actual), cantidad/unidad, y acciones editar/borrar **siempre visibles** (no ocultas a hover, porque en grilla el hover es menos descubrible, especialmente en mobile/touch).

Ubicación sugerida: `app/dashboard/_components/ViewToggle.js` y `app/dashboard/_components/ProductCard.js` (nuevo directorio de componentes compartidos entre rutas del dashboard — a confirmar contra convención real del repo durante el plan de implementación).

### Comportamiento
- Grilla responsive: 2 columnas en mobile, 3-4 en desktop (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4` o similar, a ajustar con el resto del layout).
- Mismos datos que la fila de lista — la tarjeta no agrega ni quita información, solo reorganiza.
- Sin tabs de filtro por categoría (fuera de alcance, ver arriba).
- Sin íconos ilustrados por producto (fuera de alcance, ver arriba) — la franja de color cumple ese rol visual por ahora.

### Persistencia de la preferencia
`localStorage`, una clave por sección:
- `feria:vista:compras`
- `feria:vista:inventario`

Valores: `'lista' | 'tarjetas'`. Default: `'lista'` (comportamiento actual, sin sorpresas). Se lee en un efecto al montar cada componente; si `localStorage` no está disponible (SSR) o el valor es inválido, cae al default.

No se persiste en la base de datos — es una preferencia de UI local al navegador, coherente con que no hay necesidad de sincronizar entre dispositivos para este toggle.

## 4. Archivos afectados

- **Modificar** `lib/viajeFases.mjs` — agregar `stepperState()`.
- **Modificar** `tests/viajeFases.test.mjs` — tests de `stepperState()`.
- **Crear** `app/dashboard/_components/ViewToggle.js` — toggle Lista/Tarjetas + hook de persistencia en localStorage.
- **Crear** `app/dashboard/_components/ProductCard.js` — tarjeta compartida.
- **Modificar** `app/dashboard/viajes/[id]/page.js`:
  - Nuevo componente `FaseStepper`.
  - Nuevo hook `useFaseResumen(viaje)`.
  - `ComprasTab` — agregar `ViewToggle` + render condicional lista/tarjetas usando `ProductCard`.
- **Modificar** `app/dashboard/inventario/page.js` — agregar `ViewToggle` + render condicional lista/tarjetas.
- **Modificar** `app/globals.css` — utilidades de animación del stepper (`@keyframes` de check y transición de línea) y estilos base de `ProductCard` si no alcanza con utilidades de Tailwind inline.

## 5. Testing

- Unit test (`node --test`) para `stepperState()` — los 3 casos de fase con su array de estados esperado.
- Verificación manual/e2e liviana: el toggle cambia de vista y persiste al recargar (localStorage); el stepper muestra el estado correcto en cada fase; el resumen dinámico muestra números coherentes con los datos cargados en cada tab.
- No se modifica `tests/feria-e2e.spec.js` de forma obligatoria en esta spec (el flujo de fases y compras que ya cubre sigue siendo válido con lista como vista default) — si el plan de implementación decide agregar un chequeo del toggle, es opcional/adicional, no un requisito de esta spec.

## 6. Fuera de alcance (explícito)

- Migración de framework (Next.js → Astro): evaluado aparte, no se persigue — el costo de reescribir la capa interactiva completa (casi toda la app es `'use client'`) no se justifica para una app tipo dashboard/CRUD.
- Categorías de producto / tabs de filtro.
- Íconos ilustrados por producto.
- Persistencia de la preferencia de vista en base de datos (queda en localStorage).
- Navegación libre entre fases desde el stepper (sigue siendo de solo lectura).
