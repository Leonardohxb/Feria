/**
 * webhooks.js
 * Funciones para disparar webhooks hacia n8n desde la app Next.js.
 * Todas las funciones son fire-and-forget: no bloquean el flujo principal.
 */

const N8N_WEBHOOK_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * Envía el payload de un cierre de caja al workflow n8n correspondiente.
 */
export async function triggerCierreWebhook(cierreData) {
    const endpoint = `${N8N_WEBHOOK_BASE}/webhook/cierre-caja`;

    const camposRequeridos = [
        'cajero_id', 'cajero_nombre', 'turno_inicio', 'turno_fin',
        'total_ventas_usd', 'total_ventas_bs', 'efectivo_usd_contado',
        'diferencia_usd', 'tasa_bcv',
    ];

    const faltantes = camposRequeridos.filter(
        (campo) => cierreData[campo] === undefined || cierreData[campo] === null
    );

    if (faltantes.length > 0) {
        console.warn('[webhook] triggerCierreWebhook: campos faltantes:', faltantes);
        return { ok: false, error: `Campos faltantes: ${faltantes.join(', ')}` };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': WEBHOOK_SECRET ?? '',
            },
            body: JSON.stringify(cierreData),
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Sin cuerpo de respuesta');
            console.error(`[webhook] respuesta no-OK ${response.status}:`, errorText);
            return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
        }

        const result = await response.json().catch(() => ({ ok: true }));
        if (result.alerta) {
            console.warn('[webhook] cierre marcado como ALERTA por n8n');
        }
        return { ok: true, alerta: result.alerta ?? false };

    } catch (error) {
        if (error.name === 'AbortError') {
            return { ok: false, error: 'Timeout: n8n no respondió' };
        }
        console.error('[webhook] error de red:', error.message);
        return { ok: false, error: error.message };
    }
}
