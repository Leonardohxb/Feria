import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montoUsd } from '../lib/divisas.mjs';

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
