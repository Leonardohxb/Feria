-- ============================================================
-- MIGRACIÓN: descripción de costos opcional
--   Permite registrar un costo sin descripción.
-- ============================================================

ALTER TABLE public.costos_adicionales ALTER COLUMN descripcion DROP NOT NULL;

COMMENT ON COLUMN public.costos_adicionales.descripcion IS 'Descripción opcional del costo (ej. detalle del gasto).';
