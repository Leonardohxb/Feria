# Flujo del viaje por fases — Diseño

**Fecha:** 2026-08-06
**Módulo:** Detalle de viaje (`app/dashboard/viajes/[id]/page.js`)
**Estado:** Diseño aprobado, pendiente de plan de implementación.

## Problema

Hoy el detalle del viaje muestra 4 pestañas libres (Compras, Ventas, Costos, Resumen), todas accesibles y editables desde el inicio. El dueño quiere un flujo **guiado** que refleje el orden real de un viaje: primero preparar la mercancía y los gastos iniciales, luego los gastos que salen durante el viaje, y **al final** registrar las ventas. Las opciones de venta no deben aparecer hasta esa fase final.

## Solución (Opción "Stepper + secciones contextuales")

Reemplazar la barra de pestañas por un **stepper de 3 fases**. Según la fase activa se muestran solo las secciones que corresponden. El Resumen queda siempre accesible, aparte del stepper.

### Fases

| Fase | Secciones visibles/editables | Botón de avance |
|------|------------------------------|-----------------|
| `preparacion` | Compras + Costos (gastos iniciales) | "Iniciar viaje" → `en_curso` |
| `en_curso` | Costos (gastos que salen) | "Registrar ventas" → `ventas` |
| `ventas` | Ventas | "Cerrar viaje" → `estado = 'cerrado'` |

- **Costos** es una única lista acumulativa; se surface tanto en `preparacion` (gastos iniciales) como en `en_curso` (gastos durante el viaje). Es la misma tabla `costos_adicionales`, solo cambia el momento de carga.
- **Resumen** siempre visible como acceso fijo (no es un paso del stepper).

## Modelo de datos

Se agrega una columna a `viajes`:

```sql
ALTER TABLE public.viajes
  ADD COLUMN fase TEXT NOT NULL DEFAULT 'preparacion'
  CHECK (fase IN ('preparacion', 'en_curso', 'ventas'));
```

- `fase` = **la fase más avanzada alcanzada** por el viaje (no la que se está mirando).
- Se conserva `estado` (`activo` | `cerrado`) para el cierre final. `fase` y `estado` son independientes: un viaje puede estar en `fase = 'ventas'` y seguir `activo` hasta que se cierre.

### Migración de viajes existentes

Los viajes creados antes de esta función no deben quedar con secciones ocultas. La migración los lleva a la fase más avanzada para no esconder datos ya cargados:

```sql
UPDATE public.viajes SET fase = 'ventas';
```

(El default `'preparacion'` aplica solo a viajes nuevos.)

## Máquina de estados y navegación

- **`fase` (DB)** = fase máxima alcanzada. Solo avanza, nunca retrocede.
- **`activeStep` (estado de UI)** = qué fase se está viendo. Por defecto = `fase`. El usuario puede seleccionar en el stepper cualquier paso **ya alcanzado** (índice ≤ `fase`).
- **Retroceso:** tocar un paso anterior en el stepper cambia `activeStep` (la vista), **no** `fase`. Permite volver a Preparación a corregir/agregar una compra sin perder nada; Ventas sigue desbloqueada porque ya se alcanzó.
- **Avanzar:** el botón de avance aparece solo cuando `activeStep === fase` (estás en la punta). Al avanzar, `fase` y `activeStep` pasan a la siguiente.

### Visibilidad de secciones (por `activeStep`)

- `preparacion` → `<ComprasTab>` + `<CostosTab>`
- `en_curso` → `<CostosTab>`
- `ventas` → `<VentasTab>`
- Resumen → `<ResumenTab>` (accesible siempre, vía su propio botón/acceso)

### Edición y cierre

- Mientras `estado === 'activo'`, todas las secciones de fases alcanzadas son editables (las tabs ya soportan `readOnly`).
- **Cerrar viaje** (botón en fase `ventas` cuando `fase === 'ventas'`): setea `estado = 'cerrado'` y `fecha_fin`. Con `estado === 'cerrado'` todo pasa a solo lectura (`readOnly = true` en todas las tabs) y el viaje queda histórico. El stepper se vuelve navegable pero no editable; el Resumen es la vista principal.

## UI

- **Stepper**: indicador horizontal de 3 pasos (`Preparación · En curso · Ventas`) reemplazando la actual barra de pestañas subrayadas. Pasos alcanzados: clickeables. Pasos futuros: deshabilitados/atenuados. Paso activo: resaltado con los tokens neutros del tema (`text-foreground` / `border-foreground`).
- **Acceso a Resumen**: un ítem fijo (botón "Resumen") junto al stepper que cambia `activeStep` a una vista `'resumen'` especial. Disponible en cualquier momento.
- **Botón de avance**: debajo de las secciones de la fase punta. Etiqueta según fase (`Iniciar viaje` / `Registrar ventas` / `Cerrar viaje`). El de cerrar mantiene la confirmación actual (`confirm(...)`).
- Estilo coherente con el tema neutro shadcn ya aplicado (sin colores de branding; rojo solo para acciones destructivas como cerrar).

## Componentes / cambios de código

- **`supabase/migrations/003_viaje_fase.sql`** (nuevo): `ALTER TABLE ... ADD COLUMN fase` + `UPDATE` de existentes. Aplicar vía MCP.
- **`supabase/schema.sql`**: agregar la columna `fase` a la definición de `viajes` para mantener el schema fuente alineado.
- **`app/dashboard/viajes/[id]/page.js`**: cambio principal.
  - Cargar `fase` junto con el viaje.
  - Reemplazar `TABS`/`activeTab` por un stepper de fases + acceso a Resumen (`activeStep`).
  - Renderizar secciones según `activeStep` (Compras+Costos / Costos / Ventas / Resumen).
  - Botón de avance contextual que hace `UPDATE viajes SET fase = ...`.
  - Mantener el botón/flujo de "Cerrar viaje" (ahora dentro de la fase `ventas`).
  - Las tabs `ComprasTab`/`VentasTab`/`CostosTab`/`ResumenTab` no cambian su lógica interna; solo cambia cuándo se muestran.
- **`app/dashboard/viajes/nuevo/page.js`**: sin cambios (el `INSERT` no setea `fase`; el default de la DB la pone en `preparacion`).
- **Opcional (no en esta iteración):** mostrar una etiqueta de fase en las tarjetas de viaje del dashboard.

## Casos borde

- **Viaje recién creado**: `fase = 'preparacion'`, `activeStep = 'preparacion'`, se ven Compras + Costos. Ventas no aparece en el stepper como alcanzable.
- **Avanzar sin datos**: se permite avanzar aunque no haya compras/costos (no se bloquea; el dueño decide). El botón no valida contenido.
- **Viaje cerrado**: `activeStep` navega libre, todo `readOnly`, Resumen como foco.
- **Viajes migrados (previos)**: quedan en `fase = 'ventas'`, con las tres fases navegables, sin ocultar datos.

## Fuera de alcance (YAGNI)

- Retroceder `fase` (deshacer avance): no se implementa. El avance es de una vía; el retroceso es solo de vista.
- Animaciones de transición entre fases.
- Historial/log de cambios de fase.
