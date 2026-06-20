# Prompt — Pagamentos internacionais via Stripe Connect (cobrança de mensalidades) — Aura Club Manager

> Cole no Antigravity. Objetivo: dar aos clubes que usam o Aura a capacidade de
> **cobrar mensalidades e outras taxas dos seus membros, internacionalmente**, com o
> dinheiro caindo direto na conta do clube. Concretiza a parte de pagamentos do
> Financeiro (Camada 1) usando **Stripe Connect**. Pré-requisito: Camada 1 implementada.

---

## Contexto

Você é meu engenheiro de software para o **Aura Club Manager**, SaaS multi-tenant de
gestão de clubes/escolinhas de futebol. **Mercado-alvo: apenas internacional** (UK,
Irlanda, mercados de língua espanhola, etc.) — **NÃO** vamos implementar PIX nem boleto.
O trilho de pagamento é a **Stripe**, igual ao que 360Player e Pitchero usam.

Quero que cada **clube (tenant)** consiga cobrar dos seus membros: mensalidades
recorrentes, taxas avulsas e parcelamentos, **e também as vendas da loja virtual**
(uniformes, produtos), com o dinheiro indo **direto para a conta bancária do próprio
clube** (o Aura não é o comerciante; é a plataforma que intermedia).

> Atenção ao escopo: isto cobre **clube → membro/cliente** (mensalidades + vendas da loja
> virtual). A cobrança do Aura sobre os clubes (a assinatura do SaaS, item "Subscription"
> do menu) é OUTRA coisa e não faz parte deste prompt.

## Decisões de arquitetura (siga estas)

- Use **Stripe Connect com contas Express**: uma conta conectada por clube. Onboarding
  via páginas hospedadas da Stripe (Account Links). Repasses (payouts) caem na conta do
  clube. Só liberar cobrança quando `charges_enabled` e `payouts_enabled` forem true.
- **Nunca** trafegue ou armazene dados de cartão. Use **Stripe Checkout hospedado** ou o
  **Payment Element** — PCI fica com a Stripe.
- Mensalidades recorrentes via **Stripe Billing** (Products/Prices + Subscriptions).
- **Multi-moeda**: cada clube define sua moeda (GBP, EUR, USD…).
- **SCA/3DS** é obrigatório para cartões europeus — deixe a Stripe lidar (Checkout/
  Payment Element já tratam).
- **Taxa de plataforma (opcional):** prepare `application_fee` configurável para o Aura
  poder reter um percentual por transação (como o 360Player faz). Default = 0; deixe
  fácil de ligar depois.
- **Webhooks** são a fonte da verdade do status — não confie no retorno do navegador.
  Verifique a **assinatura** do webhook e use **idempotency keys** em toda criação.
- Separe **test mode** e **live mode** por configuração.

## Regras de trabalho

1. **Antes de codar**, inspecione o repo e responda:
   - Como está o Financeiro da Camada 1? Existe a **abstração de provider de pagamento**?
     Quais entidades existem: `Plan`/mensalidade do clube, `Invoice`/`Charge`,
     `Payment`, `Guardian`, `Athlete`?
   - Já há qualquer código Stripe? Recomendo: **manter a interface abstrata e implementar
     a Stripe como provider concreto** (mesmo sendo o único por enquanto), para não
     acoplar o domínio à Stripe. Confirme comigo essa abordagem.
2. **Não toque na landing page WordPress/Elementor.**
3. **Reuse, não duplique:** `Guardian`, `Athlete`, `Plan`, `Invoice`, `Payment` e o
   módulo de **comunicação** (Camada 1) e a **loja virtual** (`Product`/`Order`/
   `OrderItem`, Camada 2) já existem — use-os. Os objetos da Stripe devem **espelhar** as
   entidades do Aura, não substituí-las.
4. Trabalhe **fase por fase**; pare e aguarde meu "ok" ao fim de cada uma.
5. **Proponha o plano antes de codar cada fase.** **Pergunte antes de operações
   destrutivas.** Escreva **testes** (com a Stripe em modo teste / mocks) para criação de
   assinatura, tratamento de webhook e reconciliação. Commits pequenos por fase.
6. Código em **inglês**; textos ao usuário em **português do Brasil** (e prontos para
   i18n, já que os clubes serão internacionais — preveja en/es/fr).
7. **Segurança/LGPD-GDPR:** nunca logar dados de cartão; guardar só IDs da Stripe
   (customer, subscription, account); webhooks com verificação de assinatura; dados de
   menores tratados conforme já definido nas camadas anteriores.

## Mapeamento de domínio → Stripe

- **Guardian (pagador)** → Stripe **Customer** (na conta conectada do clube).
- **Plano de mensalidade do clube** → Stripe **Product + Price** (recorrente ou avulso).
- **Mensalidade recorrente** → Stripe **Subscription**.
- **Cobrança avulsa / parcelamento** → **Checkout Session / PaymentIntent**.
- **Pedido da loja (`Order`, Camada 2)** → **Checkout Session / PaymentIntent** (pagamento
  único) na conta conectada do clube.
- **Invoice/Payment do Aura** → espelho dos objetos `invoice`/`payment_intent` da Stripe,
  atualizados via webhook.
- **Clube (tenant)** → Stripe **Connected Account (Express)**.

---

## Escopo por fase

### Fase 0 — Reconhecimento
Inspecione o repo, confirme o estado do Financeiro da Camada 1, das entidades acima e da
**loja virtual da Camada 2** (`Product`/`Order`/`OrderItem` e como o checkout está hoje),
verifique se já há código Stripe, e proponha o plano: manter a interface abstrata e
implementar a Stripe como provider concreto, atendendo **tanto mensalidades quanto a
loja**. Não codifique ainda.
**Pronto quando:** eu confirmo a abordagem e o mapeamento com o projeto real.

### Fase 1 — Onboarding do clube (Stripe Connect Express)
Criar a conta conectada Express por tenant; fluxo de onboarding via Account Links
hospedados; armazenar o `account_id`; tratar o webhook `account.updated`; **bloquear
cobrança** até `charges_enabled`/`payouts_enabled`. Tela no painel do clube mostrando o
status da conta de pagamentos.
**Pronto quando:** um clube conclui o onboarding da Stripe e o painel mostra "pronto para
receber".

### Fase 2 — Catálogo de cobranças
Mapear os planos de mensalidade do clube para **Products/Prices** na conta conectada,
suportando recorrente (mensal/anual) e avulso, em **multi-moeda**.
**Pronto quando:** crio um plano de mensalidade no Aura e ele vira Product/Price na conta
do clube.

### Fase 3 — Cobrança recorrente (mensalidades)
`Guardian` → Customer; criar **Subscription**; primeiro pagamento e captura de cartão via
**Checkout hospedado** (com SCA/3DS); salvar os IDs e refletir o status na `Invoice`/
`Payment` do Aura.
**Pronto quando:** matriculo um atleta num plano, o responsável paga pela página da
Stripe e a assinatura fica ativa e visível no Aura.

### Fase 4 — Checkout da loja virtual
Pagamento **único** dos pedidos (`Order`) da loja da Camada 2 via **Checkout hospedado /
Payment Element** na conta conectada do clube (Fase 1), em multi-moeda, com o dinheiro
indo para o clube. Reusa a **mesma** infraestrutura Connect das mensalidades — **não crie
um fluxo de pagamento separado**. Atualiza estoque e status do pedido conforme o resultado.
**Pronto quando:** um cliente compra um uniforme na loja, paga pela Stripe e o pedido fica
pago no Aura com o dinheiro destinado ao clube.

### Fase 5 — Webhooks e reconciliação
Endpoint de webhook com **verificação de assinatura**; tratar `checkout.session.completed`
(tanto mensalidade quanto pedido da loja), `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated/deleted`, `account.updated`; atualizar as entidades do Aura
(`Invoice`/`Payment`/`Order`) de forma **idempotente**; painel de **quem pagou / quem
deve**.
**Pronto quando:** um pagamento feito na Stripe (mensalidade ou compra na loja) aparece
corretamente no Aura sem ação manual, e um pagamento que falha marca o membro como
inadimplente.

### Fase 6 — Inadimplência e lembretes
Ativar **Smart Retries** da Stripe; disparar **lembretes automáticos** via o módulo de
comunicação da Camada 1 para faturas em aberto e falhas; aviso de cartão prestes a
expirar.
**Pronto quando:** uma fatura vencida dispara lembrete automático e a tentativa de
recobrança acontece sozinha.

### Fase 7 — Gestão (reembolso, cancelamento, avulsos)
Reembolsos; cancelar/alterar assinatura com proporcional (proration); cobranças avulsas
e parcelamento; relatórios financeiros e exportação.
**Pronto quando:** consigo reembolsar, cancelar uma assinatura e emitir uma cobrança
avulsa, tudo refletido no Aura.

### Fase 8 — (Opcional) Taxa de plataforma do Aura
Se eu pedir, ativar `application_fee` configurável por transação, para o Aura reter um
percentual sobre os pagamentos dos clubes — sem quebrar nada das fases anteriores.
**Pronto quando:** com a taxa ligada, cada pagamento do membro repassa o líquido ao clube
e a taxa ao Aura.

---

## Comece agora

Execute apenas a **Fase 0**: inspecione o repositório, confirme o estado do Financeiro da
Camada 1, verifique código Stripe existente e proponha a abordagem (interface abstrata +
Stripe como provider concreto). Não escreva código de implementação e não avance para a
Fase 1 sem minha confirmação.
