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
