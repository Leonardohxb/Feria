-- ============================================================
-- MIGRACIÓN: traslado (tasa por kg) + total_real de ventas
--   - viajes.traslado_tasa_por_kg: tasa que se suma al precio de
--     compra para dar el costo final por kg (compra + traslado).
--   - ventas.total_real: monto realmente recibido al vender
--     (cuando difiere de cantidad × precio, ej. por liquidación
--     de sobrante).
--   - Limpieza del mecanismo anterior de traslado (costo_adicional
--     tipo 'traslado' creado desde el header de Compras).
-- ============================================================

ALTER TABLE public.viajes
  ADD COLUMN IF NOT EXISTS traslado_tasa_por_kg NUMERIC(10,4) DEFAULT NULL;

COMMENT ON COLUMN public.viajes.traslado_tasa_por_kg IS 'Tasa del costo de traslado por kg (se suma al precio de compra para dar el costo final por kg). NULL o 0 = sin traslado.';

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS total_real NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.ventas.total_real IS 'Total realmente recibido al vender (si difiere de cantidad × precio_unitario, ej. por liquidación de sobrante).';

-- Limpieza del mecanismo anterior (commit d61ceb3): borrar los
-- costos_adicionales de tipo 'traslado' creados desde el header.
DELETE FROM public.costos_adicionales
WHERE tipo = 'traslado' AND descripcion = 'Traslado de compras';
