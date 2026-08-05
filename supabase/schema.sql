-- ============================================================
-- FERIA DE VEGETALES — Schema completo para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- 1. TABLA: profiles
--    Extiende auth.users con rol y nombre completo.
--    Se crea automáticamente cuando un usuario se registra.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'cajero' CHECK (role IN ('cajero', 'admin', 'dueño')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por rol
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Comentarios descriptivos
COMMENT ON TABLE public.profiles IS 'Perfiles extendidos de usuarios. Se crea automáticamente al registrarse.';
COMMENT ON COLUMN public.profiles.role IS 'Rol del usuario: cajero, admin o dueño';


-- ============================================================
-- 2. TRIGGER: crear perfil automáticamente al registrarse
--    Cuando Supabase Auth crea un usuario, se inserta
--    automáticamente una fila en profiles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    'cajero'  -- rol por defecto
  );
  RETURN NEW;
END;
$$;

-- Eliminar trigger si ya existe (evita error en re-ejecución)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 3. TRIGGER: actualizar updated_at automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 4. TABLA: cierres_caja
--    Registra el cierre de turno de cada cajero.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cierres_caja (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cajero_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cajero_nombre         TEXT NOT NULL,
  turno_inicio          TIMESTAMPTZ NOT NULL,
  turno_fin             TIMESTAMPTZ NOT NULL,
  total_ventas_usd      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_ventas_bs       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  efectivo_usd_contado  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  diferencia_usd        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tasa_bcv              NUMERIC(10, 4) NOT NULL,
  notas                 TEXT,
  alerta                BOOLEAN NOT NULL DEFAULT FALSE,  -- true si diferencia > umbral
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices útiles para reportes y listados
CREATE INDEX IF NOT EXISTS idx_cierres_cajero    ON public.cierres_caja(cajero_id);
CREATE INDEX IF NOT EXISTS idx_cierres_fecha     ON public.cierres_caja(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cierres_alerta    ON public.cierres_caja(alerta) WHERE alerta = TRUE;

-- Comentarios
COMMENT ON TABLE  public.cierres_caja IS 'Cierres de turno de caja registrados por los cajeros.';
COMMENT ON COLUMN public.cierres_caja.diferencia_usd IS 'total_ventas_usd - efectivo_usd_contado (puede ser negativo)';
COMMENT ON COLUMN public.cierres_caja.alerta IS 'TRUE si |diferencia_usd| supera el umbral configurado en n8n';
COMMENT ON COLUMN public.cierres_caja.tasa_bcv IS 'Tasa BCV USD/Bs del día en que se realizó el cierre';


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
--    Protege las tablas: cada usuario solo ve lo suyo,
--    admins y dueños ven todo.
-- ============================================================

-- --- profiles ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve y edita solo su propio perfil
CREATE POLICY "perfil_propio_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "perfil_propio_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins y dueños ven todos los perfiles
CREATE POLICY "admin_ve_todos_perfiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'dueño')
    )
  );

-- El trigger SECURITY DEFINER puede insertar perfiles sin restricción
CREATE POLICY "sistema_inserta_perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (TRUE);


-- --- cierres_caja ---
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;

-- Cajero: solo ve sus propios cierres
CREATE POLICY "cajero_ve_sus_cierres"
  ON public.cierres_caja FOR SELECT
  USING (auth.uid() = cajero_id);

-- Cajero: puede insertar cierres propios
CREATE POLICY "cajero_inserta_cierre"
  ON public.cierres_caja FOR INSERT
  WITH CHECK (auth.uid() = cajero_id);

-- Admin / Dueño: ven y modifican todos los cierres
CREATE POLICY "admin_ve_todos_cierres"
  ON public.cierres_caja FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'dueño')
    )
  );

CREATE POLICY "admin_actualiza_cierres"
  ON public.cierres_caja FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'dueño')
    )
  );

CREATE POLICY "admin_elimina_cierres"
  ON public.cierres_caja FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'dueño')
    )
  );


-- ============================================================
-- 6. VISTA: resumen de cierres (útil para reportes futuros)
-- ============================================================

CREATE OR REPLACE VIEW public.v_resumen_cierres AS
SELECT
  cc.id,
  cc.cajero_nombre,
  cc.turno_inicio,
  cc.turno_fin,
  cc.total_ventas_usd,
  cc.total_ventas_bs,
  cc.efectivo_usd_contado,
  cc.diferencia_usd,
  cc.tasa_bcv,
  cc.alerta,
  cc.notas,
  cc.created_at,
  p.role AS cajero_role
FROM public.cierres_caja cc
LEFT JOIN public.profiles p ON p.id = cc.cajero_id;

COMMENT ON VIEW public.v_resumen_cierres IS 'Vista de cierres de caja con información del cajero incluida.';


-- ============================================================
-- 7. DATOS INICIALES OPCIONALES
--    Si ya tienes un usuario registrado, puedes promoverlo
--    a admin o dueño con este UPDATE.
--    Reemplaza el correo con el tuyo.
-- ============================================================

-- UPDATE public.profiles
-- SET role = 'dueño'
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'tu@correo.com'
-- );


-- ============================================================
-- VERIFICACIÓN — ejecuta esto para confirmar que todo quedó bien
-- ============================================================

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
