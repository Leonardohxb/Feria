# Divisas por viaje + flujo "una fase a la vez" — Diseño

**Fecha:** 2026-08-06
**Módulo:** Detalle de viaje (`app/dashboard/viajes/[id]/page.js`) + DB
**Estado:** Diseño aprobado, pendiente de plan.

Dos cambios sobre la misma pantalla, que se implementan juntos:
- **A)** El flujo por fases se muestra **una fase a la vez** (se ocultan los 3 pasos del stepper).
- **B)** Cada viaje tiene sus **divisas** (USD + Bs por defecto), para dejar plasmado el precio/tasa del día en las compras.

---

## Parte A — Flujo "una fase a la vez"

### Comportamiento

- Se **elimina el stepper de 3 pasos** (Preparación · En curso · Ventas) y el acceso "Resumen" de la cabecera.
- Se muestra **solo la fase actual** (`viaje.fase`). Un indicador compacto arriba dice dónde estás: **"Paso {n} de 3 · {label}"** (n = índice de la fase +1; label de `FASE_META`).
- El **botón de avance** (Iniciar viaje → Registrar ventas → Cerrar viaje) es la única navegación hacia adelante.
- **Sin retroceso por ahora** (se define más adelante).
- **Resumen**: no se ve durante las fases. Al tocar **"Cerrar viaje"** en la fase Ventas, el viaje queda `cerrado` y muestra el **Resumen** como pantalla final (solo lectura).

### Implicancia en el estado

- Se elimina el estado `activeStep` y la navegación por stepper. La vista se deriva:
  - `estado === 'cerrado'` → Resumen.
  - Si no → contenido de `viaje.fase` + botón de avance.
- `handleCerrar` ya deja `estado = 'cerrado'` → la vista pasa a Resumen automáticamente.
- La lógica de `lib/viajeFases.mjs` (`avanceConfig`, `FASE_META`, `FASES`) se conserva. `faseAlcanzada` deja de usarse (queda en el módulo, sin consumir).

### Gating por fase (igual que antes, pero sin stepper)

| Fase | Se muestra |
|------|------------|
| `preparacion` | **Divisas del viaje** (parte B) + Compras + Costos iniciales |
| `en_curso` | Costos del viaje |
| `ventas` | Ventas |
| (cerrado) | Resumen |

---

## Parte B — Divisas por viaje

### Modelo

- **Tasa vs USD (base)**: cada divisa tiene una `tasa` = cuántas unidades equivalen a 1 USD (USD tasa 1; Bs ej. 40). El valor en USD de una compra = `cantidad × precio_unitario ÷ tasa`.
- **Una tasa por viaje** (la del día), editable mientras el viaje esté `activo`. Al editar la tasa, los totales se recalculan (no hay snapshot por compra).
- La divisa se elige **solo en Compras**. Ventas y Costos quedan en USD.

### Datos

**Nueva tabla `viaje_divisas`:**

```sql
CREATE TABLE public.viaje_divisas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,                          -- 'USD', 'Bs', ...
  tasa       NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tasa > 0),  -- unidades por 1 USD
  es_base    BOOLEAN NOT NULL DEFAULT FALSE,          -- true solo para USD
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, codigo)
);
```
RLS: acceso vía dueño del viaje (mismo patrón que `compras`).

**Trigger** `AFTER INSERT ON public.viajes`: siembra 2 divisas para el viaje nuevo — `USD` (es_base true, tasa 1) y `Bs` (tasa 1, placeholder que el dueño corrige en la preparación).

**Modificación a `compras`:**
- Se agrega `divisa_id UUID REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT`.
- `precio_unitario` pasa a guardar el precio **en la divisa elegida** (ya no siempre USD).

**Migración de datos existentes:**
1. Crear tabla + trigger + RLS.
2. Para cada viaje existente: insertar `USD` (base, tasa 1) y `Bs` (tasa 1).
3. `UPDATE compras`: set `divisa_id` = la divisa USD del viaje de esa compra (sus `precio_unitario` ya estaban en USD, así no cambian).

### UI

- **Panel "Divisas del viaje"** — arriba de todo en la fase Preparación (donde el dueño lo pidió):
  - Lista cada divisa como `1 USD = [tasa] {codigo}`. USD (base) fija: no editable ni borrable.
  - La tasa de las no-base es un input editable (guarda al confirmar). Botón para **borrar** una divisa no-base **solo si no tiene compras** (FK `ON DELETE RESTRICT`; la UI deshabilita el borrado si está en uso).
  - **"+ Agregar divisa"**: campos `codigo` + `tasa`.
  - Editable solo con viaje `activo`.
- **Formulario de Compra**: se agrega un `<select>` de divisa (las del viaje). El input de precio se rotula con el código de la divisa elegida. Al guardar, se guarda `precio_unitario` (en la divisa) + `divisa_id`. Al editar, el selector permite cambiar la divisa.
- **Fila de compra**: si la divisa es USD, se ve igual que hoy (`1 kg × $2,00 = $2,00`). Si no es USD, se muestra el monto en su divisa y el equivalente USD, ej.: `1 kg × Bs 80,00 = Bs 80,00` con `≈ $2,00` como detalle.
- **Totales** (encabezado de Compras y Resumen): se suman los **valores en USD** de cada compra (`cantidad × precio_unitario ÷ tasa`). Requiere traer la tasa de la divisa de cada compra (join `compras → viaje_divisas`).

### Wiring de componentes

- Las divisas del viaje se cargan a nivel de la vista Preparación y se pasan a `DivisasPanel` (edición) y a `ComprasTab` (selector + conversión), con un `reload` compartido para que editar una tasa refleje los totales al instante.
- `ComprasTab.load()` trae las compras con su divisa (`select('*, viaje_divisas(codigo,tasa,es_base)')`) para calcular el USD.
- `ResumenTab` calcula `total_compras` en USD usando la tasa de cada compra (trae divisa en el select de compras).

---

## Casos borde

- **Divisa Bs sin tasa real (placeholder 1)**: se permite; el panel muestra Bs prominente para que el dueño ponga la tasa del día. Sin validación dura.
- **Borrar divisa en uso**: bloqueado (FK RESTRICT + UI deshabilita). USD base nunca se borra ni edita.
- **Compra existente (pre-feature)**: queda en USD (divisa base), sin cambio de valor.
- **Viaje cerrado**: todo solo lectura, incluidas divisas; se ve el Resumen.
- **Editar tasa**: recalcula todos los totales de compras en esa divisa (no hay snapshot).

## Fuera de alcance (YAGNI)

- Retroceso entre fases (se define después).
- Divisa en Ventas/Costos (quedan en USD).
- Snapshot de tasa por compra.
- Historial de cambios de tasa.
