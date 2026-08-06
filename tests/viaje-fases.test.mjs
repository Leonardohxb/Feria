import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FASES, FASE_META, faseIndex, faseAlcanzada, siguienteFase, avanceConfig,
} from '../lib/viajeFases.mjs';

test('FASES define el orden preparacion → en_curso → ventas', () => {
  assert.deepEqual(FASES, ['preparacion', 'en_curso', 'ventas']);
});

test('faseIndex devuelve el índice, o -1 si no existe', () => {
  assert.equal(faseIndex('preparacion'), 0);
  assert.equal(faseIndex('ventas'), 2);
  assert.equal(faseIndex('inexistente'), -1);
});

test('faseAlcanzada: un paso está alcanzado si su índice <= la fase máxima', () => {
  assert.equal(faseAlcanzada('preparacion', 'en_curso'), true);
  assert.equal(faseAlcanzada('en_curso', 'en_curso'), true);
  assert.equal(faseAlcanzada('ventas', 'en_curso'), false);
  assert.equal(faseAlcanzada('ventas', 'ventas'), true);
});

test('siguienteFase devuelve la próxima fase, o null en la última', () => {
  assert.equal(siguienteFase('preparacion'), 'en_curso');
  assert.equal(siguienteFase('en_curso'), 'ventas');
  assert.equal(siguienteFase('ventas'), null);
});

test('avanceConfig da la config del botón de avance, o null en ventas', () => {
  assert.equal(avanceConfig('preparacion').next, 'en_curso');
  assert.equal(avanceConfig('preparacion').label, 'Iniciar viaje');
  assert.match(avanceConfig('preparacion').confirm, /listo para empezar/i);
  assert.equal(avanceConfig('en_curso').next, 'ventas');
  assert.equal(avanceConfig('en_curso').label, 'Registrar ventas');
  assert.equal(avanceConfig('ventas'), null);
});

test('FASE_META mapea cada fase a su etiqueta y secciones', () => {
  assert.equal(FASE_META.preparacion.label, 'Preparación');
  assert.deepEqual(FASE_META.preparacion.secciones, ['compras', 'costos']);
  assert.deepEqual(FASE_META.en_curso.secciones, ['costos']);
  assert.deepEqual(FASE_META.ventas.secciones, ['ventas']);
});
