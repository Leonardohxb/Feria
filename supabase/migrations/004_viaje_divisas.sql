-- ============================================================
-- MIGRACIÓN: divisas por viaje
--   Cada viaje tiene sus divisas (USD base + Bs por defecto).
--   Las compras guardan su precio en la divisa elegida.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.viaje_divisas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,
  tasa       NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tasa > 0),  -- unidades por 1 USD
  es_base    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_viaje_divisas_viaje ON public.viaje_divisas(viaje_id);
COMMENT ON COLUMN public.viaje_divisas.tasa IS 'Unidades de la divisa por 1 USD (USD = 1).';

ALTER TABLE public.viaje_divisas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viaje_divisas_own"
  ON public.viaje_divisas FOR ALL
  USING     (EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid()));

-- Trigger: sembrar USD + Bs al crear un viaje
CREATE OR REPLACE FUNCTION public.seed_viaje_divisas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
  VALUES (NEW.id, 'USD', 1, TRUE),
         (NEW.id, 'Bs',  1, FALSE);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_viaje_created_seed_divisas ON public.viajes;
CREATE TRIGGER on_viaje_created_seed_divisas
  AFTER INSERT ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.seed_viaje_divisas();

-- compras: divisa de cada compra (precio_unitario pasa a estar en esa divisa)
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS divisa_id UUID REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT;

-- Sembrar divisas para viajes existentes (previos al trigger)
INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
SELECT v.id, 'USD', 1, TRUE FROM public.viajes v
WHERE NOT EXISTS (SELECT 1 FROM public.viaje_divisas d WHERE d.viaje_id = v.id AND d.codigo = 'USD');

INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base)
SELECT v.id, 'Bs', 1, FALSE FROM public.viajes v
WHERE NOT EXISTS (SELECT 1 FROM public.viaje_divisas d WHERE d.viaje_id = v.id AND d.codigo = 'Bs');

-- Marcar compras existentes con la divisa USD de su viaje (sus precios ya estaban en USD)
UPDATE public.compras c
SET divisa_id = d.id
FROM public.viaje_divisas d
WHERE d.viaje_id = c.viaje_id AND d.codigo = 'USD' AND c.divisa_id IS NULL;
