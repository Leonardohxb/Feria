-- ============================================================
-- MIGRACIÓN: agrega el catálogo de productos (Inventario)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- Seguro de correr una sola vez sobre una base que ya tiene
-- profiles/viajes/compras/ventas/costos_adicionales creados.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.productos (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT    NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_productos_user ON public.productos(user_id);

COMMENT ON TABLE public.productos IS 'Catálogo de hortalizas del dueño, usado como sugerencia en compras/ventas.';

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_own"
  ON public.productos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
