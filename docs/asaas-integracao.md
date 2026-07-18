# Integração Asaas (Brasil) — arquitetura e ativação

Provider de pagamento para o mercado **Brasil**, irmão do Stripe atrás da
mesma abstração (`services/payment/`). Roteamento por país: clube BR → Asaas,
internacional → Stripe. O fluxo Stripe permanece intacto; nenhum call site foi
substituído — tudo passa a resolver o provider por tenant.

Ambiente e conta-raiz vêm de secrets (nunca hardcoded). Sandbox e produção
selecionados por `ASAAS_ENV`.

---

## Dois contextos de cobrança

1. **Aura cobra o plano do clube** (assinatura SaaS) → pela **conta-raiz** Asaas
   (CNPJ da Aura). Reflete em `tenants.subscription_status`.
2. **Clube cobra as mensalidades dos alunos** → pela **subconta do clube**. O
   dinheiro liquida na conta do clube (nunca na raiz); o clube saca pelo painel
   próprio do Asaas (modelo *subconta padrão* — sem tela de saque no Aura).

---

## Roteamento

- Coluna `tenants.payment_provider` (`'stripe' | 'asaas'`). Valor explícito
  vence; quando nulo, país = Brazil → `asaas`, senão `stripe`.
- Resolvido por `resolvePaymentProviderId(tenant)` / `getPaymentProvider(tenant)`
  em `services/payment/index.ts`. Clubes que já tinham Stripe Connect ficam no
  Stripe mesmo sendo BR (nunca quebramos um setup existente).

---

## Colunas adicionadas (ao lado das `stripe_*`)

| Tabela | Colunas |
|---|---|
| `tenants` | `payment_provider`, `asaas_customer_id`, `asaas_subscription_id` (raiz), `asaas_subaccount_id`, `asaas_wallet_id`, `asaas_subaccount_api_key_encrypted`, `asaas_charges_enabled` |
| `stripe_plans` | `price_brl` (preço em Real para o trilho Asaas; `price` continua o USD/internacional) |
| `invoices` | `asaas_payment_id`, `asaas_subscription_id`, `asaas_invoice_url` |
| `athletes` | `asaas_customer_id` (cliente reutilizável na subconta) |
| `payments` | `asaas_payment_id` (índice único parcial → idempotência) |
| `platform_settings` | chave `asaas_nfse` = `{enabled:false}` (flag da NFS-e) |

Migrations: `scripts/migration_asaas_phase1..6.sql`.

---

## Edge functions

| Função | verify_jwt | Papel |
|---|---|---|
| `asaas-status` | sim (super admin) | Testa a conta-raiz (`GET /finance/balance`) |
| `asaas-create-checkout` | sim | Plano do Aura na **raiz**: cria/reusa cliente + assinatura (ou cobrança única p/ vitalício), retorna a fatura hospedada |
| `asaas-create-subaccount` | sim (owner/admin) | Cria a **subconta** (`POST /accounts`), **criptografa a apiKey (AES-256-GCM)**, guarda `walletId`, e **auto-registra o webhook** na subconta |
| `asaas-club-checkout` | sim | Mensalidade na **subconta**: cria cliente + cobrança/assinatura, grava ids na `invoices` |
| `asaas-club-refund` | sim (owner/admin) | Reembolsa um pagamento na subconta |
| `asaas-club-cancel-subscription` | sim (owner/admin) | Cancela assinatura recorrente + cancela faturas não pagas |
| `asaas-webhook` | **não** (token) | **Endpoint único** dos dois trilhos, idempotente |
| `asaas-nfse` | sim (owner/admin) | Emite NFS-e na subconta — **gated pela flag** `asaas_nfse` (OFF por padrão) |

### Webhook (`asaas-webhook`)
Verificado pelo header `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN`. Roteia
pelo formato do `externalReference`:
- `"tenant_id:plan_id"` → pagamento de **plano** (raiz) → `subscription_status`.
- UUID de fatura → **mensalidade** (subconta) → marca `invoices` paga/vencida/
  estornada e espelha uma linha em `payments`. Idempotente (status guardado +
  índice único em `payments.asaas_payment_id`), então retries do Asaas são
  seguros.

---

## Segurança

- A **apiKey da subconta nunca vai em texto puro** ao banco, log ou cliente. É
  criptografada com **AES-256-GCM** (chave `ASAAS_ENCRYPTION_KEY`, base64 de 32
  bytes) e só descriptografada dentro das edge functions por chamada.
- **Nenhum dado de cartão** trafega pelo Aura — o pagador usa a fatura
  hospedada do Asaas (PIX/boleto/cartão).
- Escritas sensíveis exigem owner/admin do clube (ou super admin para status).

---

## Limites regulatórios (BACEN)

Ao criar a 1ª subconta via API, o Asaas abre um período de avaliação (até 60
dias) com limites (ex.: nº de subcontas / valor por conta). As funções
surfaçam a mensagem do Asaas com clareza, sem quebrar; a UI exibe o aviso dos
60 dias na criação da conta.

---

## Checklist de ativação

### Secrets (Supabase → Edge Functions → Secrets)
- [ ] `ASAAS_ENV` = `sandbox` (depois `production`)
- [ ] `ASAAS_API_KEY` = API key da **conta-raiz** do ambiente escolhido
- [ ] `ASAAS_ENCRYPTION_KEY` = `openssl rand -base64 32`
- [ ] `ASAAS_WEBHOOK_TOKEN` = um token à sua escolha

### Configuração
- [ ] Webhook da **conta-raiz** no painel Asaas → URL
  `https://wlyvaaxbqxaidvcnjnht.supabase.co/functions/v1/asaas-webhook`,
  authToken = `ASAAS_WEBHOOK_TOKEN`, eventos: `PAYMENT_CONFIRMED`,
  `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`.
  *(O webhook de cada subconta é registrado automaticamente na criação.)*
- [ ] Preencher o **Preço Asaas — BR (R$)** dos planos ativos em `/admin/plans`.
- [ ] (Opcional, depois) Ligar a **NFS-e** em `/admin/integrations` — exige a
  configuração fiscal municipal da conta do clube no Asaas.

### Teste em sandbox (fluxo end-to-end)
1. Clube BR assina um plano em `/plans` → informa CPF/CNPJ → paga na fatura
   Asaas → webhook confirma → `subscription_status = active`.
2. Clube cria a **subconta** em Configurações → Pagamentos.
3. Clube cobra uma mensalidade no Financeiro ("Cobrar via Asaas") → aluno paga
   → webhook marca a fatura como paga e insere o `payments`.
4. Reembolso/cancelamento pelos botões do Financeiro.
