'use client';

// Franja de color rotando por índice (paleta neutra del tema, sin
// colores saturados) — marcador visual temporal hasta tener íconos.
function stripeStyle(index) {
    return { background: `var(--chart-${(index % 5) + 1})` };
}

// Tarjeta compartida por las vistas de "tarjetas" de Compras e Inventario.
// - title: nombre del producto (requerido)
// - meta: subtítulo opcional (ej. "50 kg")
// - value: monto destacado opcional (ej. "$120,00")
// - dimmed: atenúa la tarjeta (ej. producto inactivo)
// - actions: nodo con los controles de la tarjeta (editar/borrar, badge, etc.)
export default function ProductCard({ index = 0, title, meta, value, dimmed = false, actions }) {
    return (
        <div className={`product-card ${dimmed ? 'opacity-50' : ''}`}>
            <div className="product-card-stripe" style={stripeStyle(index)} />
            <p className={`product-card-title ${dimmed ? 'line-through' : ''}`}>{title}</p>
            {meta && <p className="product-card-meta">{meta}</p>}
            {value && <p className="product-card-value">{value}</p>}
            {actions && <div className="product-card-actions">{actions}</div>}
        </div>
    );
}
