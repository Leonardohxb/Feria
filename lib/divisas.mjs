// Conversión de un monto en una divisa a USD.
// tasa = unidades de la divisa por 1 USD (USD tiene tasa 1).
export function montoUsd(cantidad, precioEnDivisa, tasa) {
  const t = Number(tasa) > 0 ? Number(tasa) : 1;
  return (Number(cantidad) || 0) * (Number(precioEnDivisa) || 0) / t;
}
