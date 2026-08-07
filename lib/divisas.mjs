// Conversión de un monto en una divisa a USD.
// tasa = unidades de la divisa por 1 USD (USD tiene tasa 1).
export function montoUsd(cantidad, precioEnDivisa, tasa) {
  const t = Number(tasa) > 0 ? Number(tasa) : 1;
  return (Number(cantidad) || 0) * (Number(precioEnDivisa) || 0) / t;
}

// Costo final por kg = precio de compra (en USD) + tasa de traslado por kg.
export function costoFinalPorKg(precioUnitario, tasaTraslado) {
  return (Number(precioUnitario) || 0) + (Number(tasaTraslado) || 0);
}

// Total de una venta: si viene total_real, usa ese; si no, cantidad × precio.
export function ventaTotal(cantidad, precio, totalReal) {
  if (totalReal !== null && totalReal !== undefined && totalReal !== '') {
    return Number(totalReal);
  }
  return (Number(cantidad) || 0) * (Number(precio) || 0);
}

