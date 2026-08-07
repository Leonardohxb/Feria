# Traslado (costo final por kg) + Ventas por materiales con sobrantes — Diseño

**Goal:** El traslado deja de ser un monto aparte y se incorpora al **costo final por kilogramo** de cada compra (`precio + tasa_traslado`). A su vez, las ventas pasan a basarse en los **materiales comprados en el viaje** (no el catálogo global) y admiten un **total real** opcional para reflejar liquidaciones de sobrante a menor precio.

## Modelo de datos

### Tabla `viajes`
- Nueva columna `traslado_tasa_por_kg NUMERIC(10,4) DEFAULT NULL`. NULL o 0 ⇒ sin traslado.

### Tabla `ventas`
- Nueva columna `total_real NUMERIC(10,2) DEFAULT NULL`.
  - Si es NULL → el total de la venta = `cantidad × precio_unitario`.
  - Si tiene valor → es el monto real recibido (cuando el sobrante se liquidó más barato).

### Limpieza del mecanismo anterior
- Borrar filas de `costos_adicionales` con `tipo = 'traslado'` y `descripcion = 'Traslado de compras'` (las que creaba el commit `d61ceb3`).
- Quitar `'traslado'` de `TIPOS_COSTO` y de `TIPO_ICON` (deja de ser un tipo de costo manual).
- Quitar el import de `Package` (sin uso tras la limpieza).

## Helpers (`lib/divisas.mjs`)

- `costoFinalPorKg(precioUnitario, tasaTraslado)` → devuelve el costo final por kg para una compra en kg: `precioUnitario + tasaTraslado` (0 si vienen inválidos).
- `ventaTotal(cantidad, precio, totalReal)` → `totalReal ?? (cantidad × precio)`.

Tests unitarios en `tests/divisas.test.mjs`:
- `costoFinalPorKg(1.72, 0.15) === 1.87`
- `costoFinalPorKg` con inválidos → 0 / fallback.
- `ventaTotal(1150, 1.86, null) === 2139`, `ventaTotal(1150, 1.86, 2100) === 2100`.

## Comportamiento

### ComprasTab
- El input del header pasa a ser **"Costo por kg"** (tasa). Se guarda en `viaje.traslado_tasa_por_kg`.
- Para cada item con `unidad = 'kg'`, el display pasa de `$1.72/kg` a **`$1.72 + $0.15 traslado = $1.87/kg`** y el subtotal usa el costo final (`cantidad × (precio + tasa)`).
- Items en otra unidad (caja/saco/paca/unidad/otro) **no se les suma traslado** (sigue siendo `cantidad × precio`).
- El total de la sección Compras incluye el costo final (con traslado) de los items en kg.
- NO se crea/actualiza ningún `costo_adicional` (el mecanismo anterior se elimina).

### VentasTab
- El select de producto ahora carga **los materiales comprados en el viaje** (agregados por nombre, con la cantidad total comprada). Deja de usar el catálogo global (`productos`).
- Al elegir un material, se autocompletan **unidad** y **cantidad** (la total comprada).
- El usuario ajusta cantidad (si vendió menos) y pone el **precio/kg** de venta.
- Display en vivo: **"Sin sobrantes: {cant} × {precio} = {subtotal}"**.
- Campo opcional **"Con sobrantes: $"** (manual) → el total real si el sobrante se liquidó más barato.
- Al guardar: `producto`, `cantidad`, `unidad`, `precio_unitario`, `total_real` (opcional), `fecha`, `notas`.

### ResumenTab
- **Costo de compras** se calcula con el costo final (incluye traslado) para items en kg. **No hay línea "Traslado" aparte.**
- **Ventas** se presentan con dos totales lado a lado: "sin sobrantes" (Σ `cantidad × precio`) y "con sobrantes" (Σ `total_real ?? cálculo`).
- **Ganancia bruta** = ventas (con sobrantes) − costo de compras.
- **Ganancia neta** = ganancia bruta − costos adicionales.

### Dashboard global (`app/dashboard/page.js`)
- El total de ventas por viaje usa `total_real` si existe (conversión a USD igual que antes).
- El total de compras por viaje se calcula sumando el costo final (precio + tasa de traslado del viaje) para items en kg, y `cantidad × precio` para los demás. Requiere traer `viaje_divisas(tasa)` (ya lo hace) y la `traslado_tasa_por_kg` del viaje.

## Archivos a tocar

- `supabase/migrations/009_traslado_y_ventas_total_real.sql` — nueva columna en `viajes` y en `ventas` + limpieza de `costos_adicionales` tipo 'traslado'.
- `supabase/schema.sql` — reflejar ambas columnas.
- `lib/divisas.mjs` — `costoFinalPorKg` + `ventaTotal`.
- `tests/divisas.test.mjs` — tests de los dos helpers.
- `app/dashboard/viajes/[id]/page.js` — ComprasTab (input de tasa + costo final en items + total), VentasTab (cargar materiales del viaje + heredar unidad/cantidad + campo total_real), ResumenTab (costo final + dos totales de venta), quitar `traslado` de TIPOS_COSTO y el import de `Package`.
- `app/dashboard/page.js` — dashboard global (uso de `total_real` y `traslado_tasa_por_kg`).

## Fuera de alcance

- Gestión (alta/baja/edición) de tipos de costo desde una página de inventario.
- Tracking de "cuánto queda por vender" por producto en el form de venta (validación de no vender más de lo comprado).
- Conversión de unidades no-kg a kg (las cajas/sacos no reciben traslado).
