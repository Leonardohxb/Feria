# Lógica y navegación de fases del viaje — Spec de Diseño

**Fecha:** 2026-09-05

**Contexto:** Un análisis del flujo de fases (`preparacion → en_curso → ventas`) encontró 6 fallas lógicas/de UX, algunas de ellas contradicciones directas entre lo que la interfaz promete (en los textos de confirmación) y lo que el código realmente permite. Esta spec define la solución a cada una. No se agrega concepto de stock/inventario — el catálogo de productos (`/dashboard/inventario`) sigue siendo solo una lista de nombres reutilizables, no algo a rastrear con cantidades.

**Fuera de alcance:** cualquier noción de stock/inventario con cantidades disponibles fuera del contexto de un viaje puntual; edición de divisas/tasa de traslado desde fases distintas a Preparación (se resuelve retrocediendo de fase en vez de duplicar controles).

---

## 1. Retroceder a cualquier fase anterior

**Problema:** los textos de confirmación de `avanceConfig` (`lib/viajeFases.mjs`) prometen "podrás volver a fases anteriores", pero no existe ningún mecanismo para hacerlo — `handleAvanzar` solo mueve `viaje.fase` hacia adelante.

**Solución:**
- Nuevo helper puro `fasesAnteriores(fase)` en `lib/viajeFases.mjs`: devuelve el array de fases (código + label) que preceden a `fase` según `FASES`. Vacío si `fase === FASES[0]`.
- Nuevo control en `ViajeDetallePage`, visible solo cuando `!isClosed && fasesAnteriores(viaje.fase).length > 0`: un desplegable/menú "Volver a fase anterior" que lista esas fases. Al elegir una, confirma (`confirm(...)`) y hace `supabase.from('viajes').update({ fase: elegida })`.
- Retroceder **no borra ni oculta datos**: compras, costos y ventas ya cargados permanecen en la base de datos sin cambios. Solo cambia qué sección de la página se renderiza (`vista === viaje.fase`), igual que ya ocurre hoy al avanzar.
- Los textos de `avanceConfig` (confirm de avance) no necesitan cambiar — ya eran correctos una vez que esto exista; lo que estaba mal era la ausencia de la función, no el texto.

## 2. Separar "Costos iniciales" de "Costos del viaje" en la base de datos

**Problema:** `CostosTab` en Preparación ("Costos iniciales") y en En curso ("Costos del viaje") consultan la misma tabla `costos_adicionales` sin ningún filtro — es el mismo listado con dos títulos distintos.

**Solución:**
- Migración nueva: `ALTER TABLE public.costos_adicionales ADD COLUMN fase TEXT`. Backfill de filas existentes: `UPDATE ... SET fase = 'preparacion' WHERE fase IS NULL` (supuesto pragmático — no hay forma de reconstruir en qué fase se cargó históricamente cada costo, así que se asume Preparación para todo lo existente).
- Al crear un costo nuevo (`handleSubmit` de `CostosTab`), el payload incluye `fase: viaje.fase` — **no es un campo que el usuario elija**, se completa automáticamente con la fase activa en el momento de guardar, para no agregar complejidad al formulario.
- `CostosTab` recibe una nueva prop `faseFiltro` (`'preparacion'` o `'en_curso'`) y la query agrega `.eq('fase', faseFiltro)`. Cada instancia del tab (en Preparación y en En curso) pasa su propio valor.
- El total del viaje en `ResumenTab` no cambia: sigue sumando **todos** los costos del viaje sin filtrar por fase (el desglose por fase es solo para la vista de cada tab durante el viaje, no para el cálculo final de ganancia).

## 3. Ver las compras durante En curso y Ventas (solo lectura)

**Problema:** `ComprasTab` solo se renderiza en la fase Preparación. Al vender, no hay forma de consultar cuánto se pagó por un producto sin retroceder de fase.

**Solución:**
- `ComprasTab` se renderiza también en las vistas `en_curso` y `ventas`, con `readOnly` forzado a `true` independientemente de si el viaje está cerrado (nueva prop explícita, ej. `forceReadOnly`, o simplemente pasar `readOnly={true}` cuando no es la fase Preparación — el componente ya oculta el formulario de alta y los botones de editar/borrar cuando `readOnly` es `true`, así que no requiere cambios internos en `ComprasTab`).
- Se muestra debajo del contenido principal de cada fase (`CostosTab` en En curso, `VentasTab` en Ventas), con su propio `SectionHeader` como ya tiene — el usuario ve el mismo listado/tarjetas que en Preparación, sin poder editarlo.

## 4. Tasa de traslado y divisas — sin nuevos controles de edición

**Decisión:** no se duplican los controles de `DivisasPanel` ni el input de "Traslado $/kg" en otras fases. Con el punto 1 (retroceder de fase) resuelto, corregir una tasa mal cargada es: volver a Preparación, corregirla, avanzar de nuevo. Esto evita agregar superficie de UI repetida en cada fase para una corrección que debería ser poco frecuente.

## 5. Resumen en vivo durante Ventas

**Problema:** la única vista de ganancia/pérdida (`ResumenTab`) solo se muestra después de cerrar el viaje (acción irreversible), justo cuando ya no se puede actuar sobre esa información.

**Solución:** cuando `vista === 'ventas'` (viaje no cerrado, fase Ventas), se renderiza `ResumenTab` además de `VentasTab` — mismo componente que ya se usa al cerrar, sin duplicar lógica de cálculo. Se ubica debajo de `VentasTab` (y de la vista de solo-lectura de Compras del punto 3) para no competir visualmente con el formulario de carga de ventas.

## 6. El autocompletado de Ventas no debe sugerir cantidades ya vendidas

**Problema:** `useMaterialesViaje` calcula la cantidad comprada total por producto pero no resta lo ya vendido. Al seleccionar un producto en el formulario de venta, el campo "Cantidad" se autocompleta con el total histórico comprado, no con lo que realmente queda.

**Solución:**
- `useMaterialesViaje` además consulta `ventas` del viaje (`select producto,cantidad,unidad`) y agrega, por producto, la suma vendida.
- Cada material expone un nuevo campo `restante = cantidad - vendido` (puede ser negativo si se vendió de más — no se trunca a 0, se muestra tal cual para que sea visible).
- El autocompletado de "Cantidad" en el formulario de venta usa `restante` en vez de `cantidad` (total comprado).
- La tarjeta de info del producto seleccionado (`materialSel`, ya existente en `VentasTab`) agrega una línea "Restante: X unidad" junto a lo que ya muestra (comprado, costo, traslado).
- **No hay bloqueo duro**: se puede vender más del restante calculado (mermas, ajustes de peso, ventas por bulto) — es informativo, no una validación que impida guardar.

---

## Archivos afectados

- **Modificar** `lib/viajeFases.mjs` — nuevo helper `fasesAnteriores(fase)`.
- **Modificar** `tests/viaje-fases.test.mjs` — tests de `fasesAnteriores`.
- **Crear** `supabase/migrations/010_costos_fase.sql` — columna `costos_adicionales.fase` + backfill.
- **Modificar** `supabase/schema.sql` — reflejar la nueva columna.
- **Modificar** `app/dashboard/viajes/[id]/page.js`:
  - `CostosTab`: nueva prop `faseFiltro`, filtro en la query, `fase: viaje.fase` en el payload de alta.
  - `useMaterialesViaje`: restar ventas ya registradas, exponer `restante`.
  - `VentasTab`: usar `restante` para autocompletar cantidad, mostrar "Restante" en la tarjeta de info.
  - `ViajeDetallePage`: control de "volver a fase anterior"; renderizar `ComprasTab` (solo lectura) en `en_curso`/`ventas`; renderizar `ResumenTab` dentro de la vista `ventas`.

## Testing

- Unit test (`node --test`) para `fasesAnteriores()` — casos: `preparacion` (vacío), `en_curso` (`['preparacion']`), `ventas` (`['preparacion', 'en_curso']`).
- Verificación manual: retroceder de fase y confirmar que los datos previos siguen intactos; cargar un costo en Preparación y otro en En curso y confirmar que cada tab solo muestra el suyo; vender parcialmente un producto y confirmar que el autocompletado de la segunda venta refleja el restante correcto; confirmar que el Resumen aparece dentro de Ventas sin necesidad de cerrar el viaje.
- No se modifica `tests/feria-e2e.spec.js` como requisito de esta spec — si el plan de implementación decide agregar cobertura del retroceso de fase o del resumen en vivo, es adicional, no obligatorio.
