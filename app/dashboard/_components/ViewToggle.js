'use client';
import { useEffect, useState } from 'react';
import { List, LayoutGrid } from 'lucide-react';

// Preferencia de vista (lista/tarjetas) persistida en localStorage,
// una clave por sección (ej. 'compras', 'inventario').
export function useViewPreference(key) {
    const [vista, setVistaState] = useState('lista');

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(`feria:vista:${key}`);
            if (saved === 'lista' || saved === 'tarjetas') setVistaState(saved);
        } catch {
            // localStorage no disponible (SSR o navegador restringido): queda en 'lista'.
        }
    }, [key]);

    function setVista(v) {
        setVistaState(v);
        try { window.localStorage.setItem(`feria:vista:${key}`, v); } catch { /* no-op */ }
    }

    return [vista, setVista];
}

export function ViewToggle({ value, onChange }) {
    return (
        <div className="inline-flex rounded-lg border border-border overflow-hidden shrink-0" role="group" aria-label="Cambiar vista">
            <button
                type="button"
                onClick={() => onChange('lista')}
                title="Vista de lista"
                className={`p-1.5 transition-colors ${value === 'lista' ? 'bg-foreground text-background' : 'text-stone-400 hover:text-foreground'}`}
            >
                <List className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => onChange('tarjetas')}
                title="Vista de tarjetas"
                className={`p-1.5 transition-colors border-l border-border ${value === 'tarjetas' ? 'bg-foreground text-background' : 'text-stone-400 hover:text-foreground'}`}
            >
                <LayoutGrid className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
