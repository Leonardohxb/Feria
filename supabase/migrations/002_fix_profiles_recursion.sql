-- ============================================================
-- FIX: elimina políticas viejas de "profiles" (basadas en roles
-- admin/dueño/cajero) que causan "infinite recursion detected
-- in policy for relation profiles". El esquema actual es de un
-- solo dueño por cuenta, sin roles.
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

DROP POLICY IF EXISTS "admin_ve_todos_perfiles" ON public.profiles;
DROP POLICY IF EXISTS "perfil_propio_select"    ON public.profiles;
DROP POLICY IF EXISTS "perfil_propio_update"    ON public.profiles;
DROP POLICY IF EXISTS "sistema_inserta_perfil"  ON public.profiles;

-- Recrea las políticas correctas si no existen ya
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_own'
  ) THEN
    CREATE POLICY "profiles_own"
      ON public.profiles FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_trigger_insert'
  ) THEN
    CREATE POLICY "profiles_trigger_insert"
      ON public.profiles FOR INSERT
      WITH CHECK (TRUE);
  END IF;
END $$;

-- Columna "role" ya no se usa en el modelo actual (sin roles)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
