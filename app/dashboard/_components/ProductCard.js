'use client';
import { Package, Leaf, Carrot, Apple, Wheat, Coffee, Egg, Milk, Fish, Drumstick, Sprout, ShoppingBag, Droplet, Cylinder, Flame, Cherry, Citrus, Grape } from 'lucide-react';

// Icono personalizado SVG de Tomate
function TomatoIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <circle cx="12" cy="14" r="8" />
            <path d="M12 2v4" />
            <path d="M7 5c2 1.5 5 1 5 1s3 .5 5-1" />
            <path d="M9 9c1 1 3 1 3 1s2 0 3-1" />
        </svg>
    );
}

// Componentes que consumen las imágenes PNG como "máscaras" de color 
// (Para que capten los colores de Tailwind igual que un SVG)
function PepperPngIcon(props) {
    const size = props.size || 24;
    return (
        <div
            className={props.className}
            style={{
                width: size, height: size,
                backgroundColor: 'currentColor',
                WebkitMaskImage: 'url(/pimienta-alternativa.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskImage: 'url(/pimienta-alternativa.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                transform: 'scale(1.45)',
                filter: 'drop-shadow(0.5px 0 0 currentColor) drop-shadow(-0.5px 0 0 currentColor) drop-shadow(0 0.5px 0 currentColor) drop-shadow(0 -0.5px 0 currentColor)'
            }}
        />
    );
}

function LechugaPngIcon(props) {
    const size = props.size || 24;
    return (
        <div
            className={props.className}
            style={{
                width: size, height: size,
                backgroundColor: 'currentColor',
                WebkitMaskImage: 'url(/lechuga.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskImage: 'url(/lechuga.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                transform: 'scale(1.45)',
                filter: 'drop-shadow(0.5px 0 0 currentColor) drop-shadow(-0.5px 0 0 currentColor) drop-shadow(0 0.5px 0 currentColor) drop-shadow(0 -0.5px 0 currentColor)'
            }}
        />
    );
}

// Icono personalizado SVG de Cebolla
function OnionIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {/* Tallo superior corto */}
            <path d="M10 4h4" />
            <path d="M10 4v2.5" />
            <path d="M14 4v2.5" />
            {/* Contorno exterior */}
            <path d="M10 6.5C5 7.5 3 11 3 15c0 4 4 6 9 6s9-2 9-6c0-4-2-7.5-7-8.5" />
            {/* Pétalo central */}
            <path d="M12 7c-2 2.5-2.5 5.5-2.5 9 0 2 1 4 2.5 5 1.5-1 2.5-3 2.5-5 0-3.5-.5-6.5-2.5-9z" />
            {/* Lóbulos/Gajos laterales */}
            <path d="M12 21c-4-2-4.5-6-4.5-9 0-2.5 1-4.5 2.5-5.5" />
            <path d="M12 21c4-2 4.5-6 4.5-9 0-2.5-1-4.5-2.5-5.5" />
            {/* Pequeñas raíces */}
            <path d="M12 21v3" />
            <path d="M9.5 23.5L12 21" />
            <path d="M14.5 23.5L12 21" />
        </svg>
    );
}

// Icono de Ají / Chili (basado en Tabler Icons, MIT license)
function ChiliIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M13 11c0 2.21 -2.239 4 -5 4s-5 -1.79 -5 -4a8 8 0 1 0 16 0a3 3 0 0 0 -6 0" />
            <path d="M16 8c0 -2 2 -4 4 -4" />
        </svg>
    );
}

// Utility para determinar el icono según el nombre (individual y sin mezclar)
function getProductIcon(name) {
    if (!name) return Package;
    const n = name.toLowerCase();

    // Tubérculos y raíces
    if (n === 'zanahoria') return Carrot;
    if (n === 'apio') return Package;
    if (n === 'papa') return Package;
    if (n === 'yuca' || n === 'mandioca') return Package;
    if (n === 'ñame' || n === 'ocumo') return Package;
    if (n === 'batata') return Package;

    // Hierbas y hojas
    if (n === 'cilantro' || n.includes('cilantro')) return Sprout;
    if (n === 'cebollin' || n.includes('cebollín')) return Sprout;
    if (n === 'lechuga') return LechugaPngIcon;
    if (n === 'repollo') return LechugaPngIcon;
    if (n === 'celery' || n.includes('españa')) return Sprout;

    // Aliños, frutos y flores
    if (n === 'aji' || n.includes('ají') || n === 'chili') return ChiliIcon;
    if (n === 'pimenton' || n.includes('pimentón')) return PepperPngIcon;
    if (n === 'tomate' || n.includes('tomate')) return TomatoIcon;
    if (n === 'aguacate') return Egg;
    if (n === 'berenjena') return Package;
    if (n === 'calabacin' || n.includes('calabacín')) return Package;
    if (n === 'auyama') return Package;
    if (n === 'vainita' || n.includes('vainita')) return Sprout;
    if (n === 'cebolla') return OnionIcon;
    if (n === 'ajo') return Package;


    // Frutas (las más básicas)
    if (n === 'platano' || n.includes('plátano') || n === 'cambur') return Package;
    if (n === 'manzana' || n.includes('manzana')) return Apple;
    if (n === 'naranja' || n === 'limon' || n === 'limón' || n === 'mandarina') return Citrus;
    if (n === 'uva') return Grape;
    if (n === 'cereza') return Cherry;

    // Básicos y proteínas
    if (n.includes('maiz') || n.includes('maíz') || n.includes('jojoto')) return Wheat;
    if (n.includes('trigo') || n.includes('harina')) return Wheat;
    if (n.includes('cafe') || n.includes('café')) return Coffee;
    if (n.includes('huevo')) return Egg;
    if (n.includes('leche') || n.includes('queso') || n.includes('suero') || n.includes('natilla')) return Milk;
    if (n.includes('pescado')) return Fish;
    if (n.includes('carne') || n.includes('res') || n.includes('cerdo')) return Drumstick;
    if (n.includes('pollo') || n.includes('gallina')) return Drumstick;
    if (n.includes('aceite')) return Droplet;
    if (n.includes('gas') || n.includes('bombona')) return Flame;

    return Package;
}

export default function ProductCard({ title, meta, value, dimmed = false, actions, layout = 'horizontal' }) {
    const Icon = getProductIcon(title);

    if (layout === 'vertical') {
        return (
            <div className={`p-5 h-full bg-card/60 backdrop-blur-xl border border-border flex flex-col items-center text-center shadow-sm rounded-3xl transition-all hover:border-primary/40 hover:shadow-md group ${dimmed ? 'opacity-50 grayscale' : ''}`}>
                <div className="mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted border border-border/50 shadow-sm flex items-center justify-center shrink-0 text-primary/80 group-hover:text-primary group-hover:bg-primary/10 transition-colors mx-auto">
                        <Icon className="w-8 h-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="flex-1 w-full flex flex-col justify-center">
                    <p className={`text-base font-bold text-foreground line-clamp-2 leading-tight ${dimmed ? 'line-through' : ''}`}>
                        {title}
                    </p>
                    {meta && (
                        <p className="text-xs font-medium text-muted-foreground truncate opacity-80 mt-1">
                            {meta}
                        </p>
                    )}
                    {value && (
                        <p className="text-xl font-black text-foreground tabular mt-2">
                            {value}
                        </p>
                    )}
                </div>

                {actions && (
                    <div className="mt-4 pt-4 border-t border-border/50 w-full flex justify-center">
                        {actions}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`p-4 bg-card/60 backdrop-blur-xl border border-border shadow-sm rounded-2xl flex items-center gap-4 transition-all hover:border-primary/40 hover:shadow-md group ${dimmed ? 'opacity-50 grayscale' : ''}`}>
            {/* Left Icon Container */}
            <div className="w-12 h-12 rounded-xl bg-muted border border-border shadow-sm flex items-center justify-center shrink-0 text-primary/80 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
            </div>

            {/* Title & Meta Info */}
            <div className="flex-1 min-w-0">
                <p className={`text-base font-bold text-foreground truncate ${dimmed ? 'line-through' : ''}`}>
                    {title}
                </p>
                {meta && (
                    <p className="text-sm font-medium text-muted-foreground truncate opacity-80 mt-0.5">
                        {meta}
                    </p>
                )}
            </div>

            {/* Values & Actions */}
            <div className="flex items-center gap-3 shrink-0">
                {value && (
                    <div className="text-right flex flex-col justify-center">
                        <p className="text-lg font-black text-foreground tabular">
                            {value}
                        </p>
                    </div>
                )}
                {actions && (
                    <div className="flex items-center ml-2 border-l border-border pl-2">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
