import { supabase } from './supabase';
import { asaasModeHeader } from './asaasConfig';

// Asaas SaaS-billing client (Aura charging a BR club its plan). Mirrors the
// role of lib/stripe.ts's createCheckoutSession, but the hosted invoice URL
// (PIX/boleto/card) is created server-side in the asaas-create-checkout
// edge function.
export async function createAsaasCheckout(
    planId: string,
    tenantId: string,
    cpfCnpj: string,
    email?: string,
    name?: string,
): Promise<{ url: string }> {
    const { data, error } = await supabase.functions.invoke('asaas-create-checkout', {
        body: { plan_id: planId, tenant_id: tenantId, cpf_cnpj: cpfCnpj, email, name },
        headers: asaasModeHeader(),
    });
    if (error) {
        let msg = data?.error || error.message || 'Erro ao criar a cobrança.';
        try {
            const body = await (error as any).context?.json?.();
            if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.url) throw new Error('URL de pagamento não retornada.');
    return data as { url: string };
}
