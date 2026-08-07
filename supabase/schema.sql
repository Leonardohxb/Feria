-- ============================================================
-- FERIA DE VEGETALES — Schema para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- 1. TABLA: profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfil del dueño de la feria.';


-- ============================================================
-- 2. TRIGGER: crear perfil automáticamente al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 3. TABLA: viajes
--    Unidad central. Cada viaje agrupa compras, ventas y costos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.viajes (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       TEXT  NOT NULL,
  descripcion  TEXT,
  fecha_inicio DATE  NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin    DATE,
  estado       TEXT  NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cerrado')),
  fase         TEXT  NOT NULL DEFAULT 'preparacion' CHECK (fase IN ('preparacion', 'en_curso', 'ventas')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viajes_user    ON public.viajes(user_id);
CREATE INDEX IF NOT EXISTS idx_viajes_estado  ON public.viajes(estado);

COMMENT ON TABLE  public.viajes        IS 'Cada viaje que realiza el dueño para comprar y vender hortalizas.';
COMMENT ON COLUMN public.viajes.estado IS 'activo: en curso. cerrado: finalizado, se calcula la ganancia.';


-- ============================================================
-- 3b. TABLA: viaje_divisas
--     Divisas propias de cada viaje (USD base + Bs por defecto).
--     Sembrada automáticamente por el trigger seed_viaje_divisas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.viaje_divisas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   UUID NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,
  tasa       NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tasa > 0),
  es_base    BOOLEAN NOT NULL DEFAULT FALSE,
  fija       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viaje_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_viaje_divisas_viaje ON public.viaje_divisas(viaje_id);

COMMENT ON TABLE  public.viaje_divisas       IS 'Divisas propias de cada viaje (USD base + Bs y COP fijas por defecto).';
COMMENT ON COLUMN public.viaje_divisas.tasa  IS 'Unidades de la divisa por 1 USD (USD = 1).';
COMMENT ON COLUMN public.viaje_divisas.fija  IS 'TRUE para divisas fijas sembradas (USD, Bs, COP): no borrables.';

-- Trigger: sembrar USD + Bs + COP al crear un viaje
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

DROP TRIGGER IF EXISTS on_viaje_created_seed_divisas ON public.viajes;
CREATE TRIGGER on_viaje_created_seed_divisas
  AFTER INSERT ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.seed_viaje_divisas();


-- ============================================================
-- 4. TABLA: productos
--    Catálogo de hortalizas del dueño, reutilizable entre viajes.
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


-- ============================================================
-- 4b. TABLA: costo_tipos
--     Catálogo de tipos de costo custom del dueño (los 8
--     predeterminados viven en el cliente). Análoga a productos.
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


-- ============================================================
-- 5. TABLA: compras
--    Lo que el dueño compró a los proveedores en el viaje.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compras (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id         UUID           NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  producto         TEXT           NOT NULL,
  cantidad         NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
  unidad           TEXT           NOT NULL DEFAULT 'kg',
  precio_unitario  NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  divisa_id        UUID           REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT,
  fecha            DATE           NOT NULL DEFAULT CURRENT_DATE,
  notas            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_viaje ON public.compras(viaje_id);

COMMENT ON TABLE  public.compras                  IS 'Compras de hortalizas realizadas en el viaje.';
COMMENT ON COLUMN public.compras.precio_unitario  IS 'Precio pagado por unidad de medida en la divisa elegida.';
COMMENT ON COLUMN public.compras.divisa_id        IS 'Divisa en la que está expresado precio_unitario (refiere a viaje_divisas).';


-- ============================================================
-- 6. TABLA: ventas
--    Lo que el dueño vendió durante o después del viaje.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ventas (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id         UUID           NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  producto         TEXT           NOT NULL,
  cantidad         NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
  unidad           TEXT           NOT NULL DEFAULT 'kg',
  precio_unitario  NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  fecha            DATE           NOT NULL DEFAULT CURRENT_DATE,
  notas            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_viaje ON public.ventas(viaje_id);

COMMENT ON TABLE public.ventas IS 'Ventas de hortalizas realizadas durante el viaje.';


-- ============================================================
-- 7. TABLA: costos_adicionales
--    Gastos operativos del viaje: obreros, comida, hotel, gasolina, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.costos_adicionales (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id     UUID           NOT NULL REFERENCES public.viajes(id) ON DELETE CASCADE,
  tipo         TEXT           NOT NULL,
  descripcion  TEXT           NOT NULL,
  monto        NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
  divisa_id    UUID           REFERENCES public.viaje_divisas(id) ON DELETE RESTRICT,
  fecha        DATE           NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costos_viaje ON public.costos_adicionales(viaje_id);

COMMENT ON TABLE  public.costos_adicionales  IS 'Gastos adicionales del viaje: administración, obreros, comida, hotel, gasolina, etc.';
COMMENT ON COLUMN public.costos_adicionales.tipo      IS 'Categoría: administracion, obreros, comida, hotel, gasolina, gasoil, transporte, otro, o custom.';
COMMENT ON COLUMN public.costos_adicionales.divisa_id IS 'Divisa en la que está expresado monto (refiere a viaje_divisas).';


-- ============================================================
-- 8. ROW LEVEL SECURITY
--    El dueño solo accede a sus propios datos.
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- El trigger SECURITY DEFINER puede insertar sin restricción
CREATE POLICY "profiles_trigger_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (TRUE);

-- viajes
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viajes_own"
  ON public.viajes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- viaje_divisas (acceso a través de ownership del viaje)
ALTER TABLE public.viaje_divisas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viaje_divisas_own"
  ON public.viaje_divisas FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  );

-- productos
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_own"
  ON public.productos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- costo_tipos
ALTER TABLE public.costo_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costo_tipos_own"
  ON public.costo_tipos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- compras (acceso a través de ownership del viaje)
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_own"
  ON public.compras FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  );

-- ventas
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_own"
  ON public.ventas FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  );

-- costos_adicionales
ALTER TABLE public.costos_adicionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costos_own"
  ON public.costos_adicionales FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.user_id = auth.uid())
  );


-- ============================================================
-- 9. VISTA: resumen por viaje
-- ============================================================

CREATE OR REPLACE VIEW public.v_resumen_viajes AS
SELECT
  v.id,
  v.nombre,
  v.fecha_inicio,
  v.fecha_fin,
  v.estado,
  v.user_id,
  COALESCE(SUM(c.cantidad * c.precio_unitario), 0)            AS total_compras,
  COALESCE(SUM(ve.cantidad * ve.precio_unitario), 0)          AS total_ventas,
  COALESCE(SUM(ca.monto), 0)                                  AS total_costos,
  COALESCE(SUM(ve.cantidad * ve.precio_unitario), 0)
    - COALESCE(SUM(c.cantidad * c.precio_unitario), 0)
    - COALESCE(SUM(ca.monto), 0)                              AS ganancia_neta
FROM public.viajes v
LEFT JOIN public.compras           c  ON c.viaje_id  = v.id
LEFT JOIN public.ventas            ve ON ve.viaje_id = v.id
LEFT JOIN public.costos_adicionales ca ON ca.viaje_id = v.id
GROUP BY v.id;

COMMENT ON VIEW public.v_resumen_viajes IS 'Totales calculados por viaje: compras, ventas, costos y ganancia neta.';


-- ============================================================
-- VERIFICACIÓN
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
-- ============================================================
