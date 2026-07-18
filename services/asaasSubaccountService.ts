import { supabase } from '../lib/supabase';
import { asaasModeHeader } from '../lib/asaasConfig';

export interface CreateSubaccountInput {
    tenantId: string;
    name?: string;
    email: string;
    cpfCnpj: string;
    mobilePhone: string;
    incomeValue: number;
    address: string;
    addressNumber: string;
    province: string;      // bairro
    postalCode: string;
    complement?: string;
    companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';
    birthDate?: string;    // required when cpfCnpj is a CPF
}

export interface CreateSubaccountResult {
    success: boolean;
    subaccount_id: string;
    evaluation_notice?: string;
}

// Creates the club's Asaas subaccount (subconta padrão). The subaccount's
// apiKey is encrypted and stored server-side — it is never returned here.
export const asaasSubaccountService = {
    async create(input: CreateSubaccountInput): Promise<CreateSubaccountResult> {
        const { data, error } = await supabase.functions.invoke('asaas-create-subaccount', {
            headers: asaasModeHeader(),
            body: {
                tenant_id: input.tenantId,
                name: input.name,
                email: input.email,
                cpf_cnpj: input.cpfCnpj,
                mobile_phone: input.mobilePhone,
                income_value: input.incomeValue,
                address: input.address,
                address_number: input.addressNumber,
                province: input.province,
                postal_code: input.postalCode,
                complement: input.complement,
                company_type: input.companyType,
                birth_date: input.birthDate,
            },
        });
        if (error) {
            let msg = data?.error || error.message || 'Erro ao criar a conta de recebimento.';
            try {
                const body = await (error as any).context?.json?.();
                if (body?.error) msg = body.error;
            } catch {}
            throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        return data as CreateSubaccountResult;
    },
};
