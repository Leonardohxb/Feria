// Lógica pura del flujo por fases del viaje.
// Importable por Next (app) y por node --test (unit) sin configuración extra.

export const FASES = ['preparacion', 'en_curso', 'ventas'];

export const FASE_META = {
  preparacion: { label: 'Preparación', secciones: ['compras', 'costos'] },
  en_curso:    { label: 'En curso',    secciones: ['costos'] },
  ventas:      { label: 'Ventas',      secciones: ['ventas'] },
};

export function faseIndex(fase) {
  return FASES.indexOf(fase);
}

// ¿El paso `step` ya fue alcanzado dado el máximo `faseMax`?
export function faseAlcanzada(step, faseMax) {
  const i = faseIndex(step);
  const m = faseIndex(faseMax);
  return i >= 0 && m >= 0 && i <= m;
}

// Próxima fase, o null si ya es la última.
export function siguienteFase(fase) {
  const i = faseIndex(fase);
  return i >= 0 && i < FASES.length - 1 ? FASES[i + 1] : null;
}

// Config del botón de avance para la fase punta actual.
// En 'ventas' devuelve null: ahí el avance es "Cerrar viaje" (manejado aparte).
export function avanceConfig(fase) {
  if (fase === 'preparacion') return {
    next: 'en_curso',
    label: 'Iniciar viaje',
    confirm: '¿Ya estás listo para empezar el viaje? Podrás volver a Preparación si necesitás corregir algo.',
  };
  if (fase === 'en_curso') return {
    next: 'ventas',
    label: 'Registrar ventas',
    confirm: '¿Pasar a registrar las ventas? Podrás volver a fases anteriores si hace falta.',
  };
  return null;
}
