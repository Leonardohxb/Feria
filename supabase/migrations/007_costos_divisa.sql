-- ============================================================
-- MIGRACIÓN: divisa en costos_adicionales
--   Cada costo adicional guarda su monto en la divisa elegida
--   (de las divisas del viaje), igual que las compras.
--   Conversión a USD = monto ÷ tasa.
-- ============================================================

ALTER TABLE public.costos_adicionales
  ADD COLUMN IF NOT EXISTS divisa_id UUID REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.costos_adicionales.divisa_id IS 'Divisa en la que está expresado monto (refiere a viaje_divisas).';

-- Marcar costos existentes con la divisa USD de su viaje (sus montos ya estaban en USD)
UPDATE public.costos_adicionales c
SET divisa_id = d.id
FROM public.viaje_divisas d
WHERE d.viaje_id = c.viaje_id AND d.codigo = 'USD' AND c.divisa_id IS NULL;
