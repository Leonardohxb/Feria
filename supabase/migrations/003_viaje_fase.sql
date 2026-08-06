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
