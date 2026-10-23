-- ============================================
-- payments.method only allowed cash/pix/card/bank_transfer/other, but the
-- Asaas webhook writes the payer's billingType. Everything except PIX violated
-- the constraint, so the invoice was marked paid while the payments row was
-- silently dropped — the club saw money received with no payment record.
--
-- Boleto is a first-class method in Brazil and deserves its own value rather
-- than being folded into 'other', which would lose real financial detail.
-- asaas-webhook's paymentMethodFor() maps every other billingType onto this set.
-- Safe to re-run.
-- ============================================

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method = ANY (ARRAY[
    'cash'::text,
    'pix'::text,
    'boleto'::text,
    'card'::text,
    'bank_transfer'::text,
    'other'::text
  ]));
