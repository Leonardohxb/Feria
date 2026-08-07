-- ============================================================
-- MIGRACIÓN: divisas fijas (USD, Bs, COP)
--   Agrega columna `fija` para distinguir las divisas sembradas
--   (no borrables) de las que agregue el usuario.
--   Siembra COP para viajes existentes y actualiza el trigger para
--   que los nuevos viajes nazcan con las 3 fijas.
-- ============================================================

ALTER TABLE public.viaje_divisas
  ADD COLUMN IF NOT EXISTS fija BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.viaje_divisas.fija IS 'TRUE para divisas fijas sembradas (USD, Bs, COP): no borrables.';

-- Marcar como fijas las USD y Bs ya sembradas por la 004
UPDATE public.viaje_divisas
SET fija = TRUE
WHERE codigo IN ('USD', 'Bs');

-- Sembrar COP (fija) para viajes existentes que no la tengan
INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base, fija)
SELECT v.id, 'COP', 1, FALSE, TRUE
FROM public.viajes v
WHERE NOT EXISTS (
  SELECT 1 FROM public.viaje_divisas d
  WHERE d.viaje_id = v.id AND d.codigo = 'COP'
);

-- Reemplazar el trigger para sembrar 3 divisas fijas (USD, Bs, COP)
CREATE OR REPLACE FUNCTION public.seed_viaje_divisas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.viaje_divisas (viaje_id, codigo, tasa, es_base, fija)
  VALUES (NEW.id, 'USD', 1, TRUE,  TRUE),
         (NEW.id, 'Bs',  1, FALSE, TRUE),
         (NEW.id, 'COP', 1, FALSE, TRUE);
  RETURN NEW;
END;
$$;
