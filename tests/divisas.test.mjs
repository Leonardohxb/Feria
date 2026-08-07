import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montoUsd, costoFinalPorKg, ventaTotal } from '../lib/divisas.mjs';

test('montoUsd: USD (tasa 1) devuelve cantidad × precio', () => {
  assert.equal(montoUsd(10, 5, 1), 50);
  assert.equal(montoUsd(11, 122, 1), 1342);
});

test('montoUsd: divisa con tasa convierte a USD (÷ tasa)', () => {
  assert.equal(montoUsd(1, 80, 40), 2);      // 1 × 80 Bs ÷ 40 = 2 USD
  assert.equal(montoUsd(2, 200, 40), 10);    // 2 × 200 Bs ÷ 40 = 10 USD
});

test('montoUsd: valores inválidos/nulos dan 0 o no rompen', () => {
  assert.equal(montoUsd(undefined, 5, 40), 0);
  assert.equal(montoUsd(10, undefined, 40), 0);
  assert.equal(montoUsd(10, 5, 0), 50);      // tasa 0/ inválida cae a 1
  assert.equal(montoUsd(10, 5, null), 50);
});

test('costoFinalPorKg: precio de compra + tasa de traslado', () => {
  const eps = (a, b) => Math.abs(a - b) < 0.0001;
  assert.ok(eps(costoFinalPorKg(1.72, 0.15), 1.87));
  assert.ok(eps(costoFinalPorKg(1.72, 0), 1.72));
  assert.ok(eps(costoFinalPorKg(undefined, 0.15), 0.15));
  assert.ok(eps(costoFinalPorKg(1.72, undefined), 1.72));
});

test('ventaTotal: usa total_real si viene, si no cantidad × precio', () => {
  assert.equal(ventaTotal(1150, 1.86, null), 2139);
  assert.equal(ventaTotal(1150, 1.86, 2100), 2100);
  assert.equal(ventaTotal(1150, 1.86, ''), 2139);
  assert.equal(ventaTotal(1150, 1.86, undefined), 2139);
});

