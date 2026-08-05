'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabaseClient';
import { triggerCierreWebhook } from '@/lib/webhooks';

const defaultForm = {
    turno_inicio: '',
    turno_fin: '',
    total_ventas_usd: '',
    total_ventas_bs: '',
    efectivo_usd_contado: '',
    tasa_bcv: '',
    notas: '',
};

export default function CierreCajaPage() {
    const { user, profile } = useAuth();
    const [form, setForm] = useState(defaultForm);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // null | 'ok' | 'error'
    const [mensaje, setMensaje] = useState('');

    const diferencia = form.total_ventas_usd && form.efectivo_usd_contado
        ? (parseFloat(form.total_ventas_usd) - parseFloat(form.efectivo_usd_contado)).toFixed(2)
        : null;

    function handleChange(e) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            const cierreData = {
                cajero_id: user.id,
                cajero_nombre: profile?.full_name ?? user.email,
                turno_inicio: form.turno_inicio,
                turno_fin: form.turno_fin,
                total_ventas_usd: parseFloat(form.total_ventas_usd),
                total_ventas_bs: parseFloat(form.total_ventas_bs),
                efectivo_usd_contado: parseFloat(form.efectivo_usd_contado),
                diferencia_usd: parseFloat(diferencia),
                tasa_bcv: parseFloat(form.tasa_bcv),
                notas: form.notas || null,
            };

            // 1. Guardar en Supabase
            const { error } = await supabase.from('cierres_caja').insert(cierreData);
            if (error) throw error;

            // 2. Fire-and-forget webhook a n8n
            triggerCierreWebhook(cierreData);

            setStatus('ok');
            setMensaje('Cierre de caja registrado correctamente ✅');
            setForm(defaultForm);
        } catch (err) {
            setStatus('error');
            setMensaje(err.message ?? 'Error al registrar el cierre.');
        } finally {
            setLoading(false);
        }
    }

    const Field = ({ label, name, type = 'number', placeholder, required = true, step }) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
                id={name} name={name} type={type} step={step} required={required}
                value={form[name]} onChange={handleChange}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
        </div>
    );

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-green-900">Cierre de Caja</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Registra los totales de tu turno. El sistema notificará automáticamente al administrador.
                </p>
            </div>

            <div className="card">
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* Turno */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Inicio del turno" name="turno_inicio" type="datetime-local" placeholder="" />
                        <Field label="Fin del turno" name="turno_fin" type="datetime-local" placeholder="" />
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Totales de ventas</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Total ventas (USD)" name="total_ventas_usd" step="0.01" placeholder="0.00" />
                            <Field label="Total ventas (Bs)" name="total_ventas_bs" step="0.01" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conteo físico</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Efectivo contado (USD)" name="efectivo_usd_contado" step="0.01" placeholder="0.00" />
                            <Field label="Tasa BCV del día" name="tasa_bcv" step="0.01" placeholder="Ej: 42.50" />
                        </div>
                    </div>

                    {/* Diferencia calculada */}
                    {diferencia !== null && (
                        <div className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${Math.abs(parseFloat(diferencia)) > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-green-50 text-green-700 border border-green-200'
                            }`}>
                            <span>{Math.abs(parseFloat(diferencia)) > 0 ? '⚠️' : '✅'}</span>
                            Diferencia: <span className="font-bold">${diferencia} USD</span>
                            {Math.abs(parseFloat(diferencia)) > 5 && (
                                <span className="ml-auto text-xs font-normal text-red-500">Alerta: diferencia mayor a $5</span>
                            )}
                        </div>
                    )}

                    <div>
                        <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                        <textarea
                            id="notas" name="notas" rows={2}
                            value={form.notas} onChange={handleChange}
                            placeholder="Observaciones del turno..."
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                        />
                    </div>

                    {status && (
                        <p className={`text-sm rounded-xl px-4 py-3 ${status === 'ok'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-600 border border-red-200'
                            }`}>{mensaje}</p>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm shadow-sm shadow-green-200"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                Registrando...
                            </span>
                        ) : 'Registrar Cierre de Caja'}
                    </button>
                </form>
            </div>
        </div>
    );
}
