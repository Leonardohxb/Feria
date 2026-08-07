-- ============================================================
-- MIGRACIÓN: catálogo de tipos de costo custom por usuario
--   Permite al usuario agregar tipos de costo además de los 8
--   predeterminados (administracion, obreros, etc., que viven
--   en el cliente). Análoga a la tabla `productos`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.costo_tipos (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT    NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_costo_tipos_user ON public.costo_tipos(user_id);

COMMENT ON TABLE public.costo_tipos IS 'Catálogo de tipos de costo custom del dueño (los predeterminados viven en el cliente).';

ALTER TABLE public.costo_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costo_tipos_own"
  ON public.costo_tipos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
