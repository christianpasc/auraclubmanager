# Prompt — Migrar pagamentos de Stripe Connect Express → Standard (alterar o existente)

> Cole no Antigravity. **Não é uma reconstrução.** O módulo de pagamentos já foi
> implementado no modelo **Express** (estilo Pitchero). Quero **alterar só o necessário**
> para passar ao modelo **Standard** (estilo 360Player), preservando tudo que já funciona.

---

## Contexto

O Aura já tem o módulo de pagamentos via **Stripe Connect Express** implementado:
onboarding via Account Links hospedados, contas conectadas Express, e provavelmente
**destination charges** com webhooks no nível da plataforma. Quero mudar para **Stripe
Connect Standard**:

- Cada clube **conecta a própria conta Stripe** (cria nova ou liga existente) via **OAuth**.
- O **clube é o merchant of record**: administra o próprio painel, lida com as próprias
  disputas/reembolsos e é responsável pelos próprios saldos.
- A Aura **NÃO** assume responsabilidade por saldos negativos.
- Cobrança via **direct charges** (o dinheiro liquida na conta do clube, não no saldo da
  Aura).

**Altere apenas o que for necessário para essa troca. Não reescreva o que já está certo**
(catálogo de planos, mensalidade recorrente, checkout da loja, lembretes, etc. devem
continuar funcionando — só mudam onde/como a cobrança acontece).

## Aviso técnico crítico (leia antes de planejar)

1. **O tipo da conta conectada (Express vs Standard) é fixado na criação e NÃO pode ser
   convertido no lugar.** O código deve passar a **criar/conectar novas contas como
   Standard via OAuth**. Contas **Express já existentes** (de teste ou reais) precisam ser
   **reconectadas** como Standard — não há migração automática. Verifique se já existem
   contas conectadas e me diga como tratá-las (em ambiente de teste, normalmente é só
   descartar).
2. **Mudar de destination charges para direct charges muda ONDE os objetos são criados.**
   Customer, Subscription, PaymentIntent e Checkout Session passam a ser criados **na
   conta conectada** (contexto `Stripe-Account` / `stripeAccount`), não na plataforma.
   Audite cada ponto onde esses objetos são criados hoje.

## Regras de trabalho

1. **Antes de alterar qualquer coisa**, faça a auditoria da Fase 0 e me apresente o
   **diff exato** a aplicar. Não mude código na Fase 0.
2. **Não toque na landing page WordPress/Elementor** nem no que está fora do escopo de
   pagamentos.
3. **Preserve o que funciona.** Mantenha a interface abstrata de provider, as entidades do
   Aura (`Invoice`/`Payment`/`Order`/`Guardian`) e a reutilização das Camadas 1 e 2.
4. Trabalhe **fase por fase**; pare e aguarde meu "ok" ao fim de cada uma.
5. **Pergunte antes de operações destrutivas** — especialmente apagar contas conectadas,
   objetos Stripe ou rodar migrações. Atualize os **testes** existentes (modo teste da
   Stripe) e adicione os que faltarem. Commits pequenos por fase.
6. Código em **inglês**; textos ao usuário em **português do Brasil** (i18n: en/es/fr).

---

## Escopo por fase (só o delta Express → Standard)

### Fase 0 — Auditoria do que já existe
Mapeie a implementação Stripe atual e me reporte: (a) como é o onboarding hoje (Account
Links/Express); (b) qual o tipo de cobrança atual (destination? direct?); (c) **onde**
são criados Customer, Subscription, PaymentIntent e Checkout Session, e em qual conta
(plataforma ou conectada); (d) como os webhooks estão configurados (plataforma vs Connect);
(e) se há config de responsabilidade por saldo negativo apontando para a plataforma; (f)
se já existem contas conectadas Express (teste/produção). Entregue o **diff exato** para
chegar ao Standard + direct charges. **Não altere código ainda.**
**Pronto quando:** eu aprovo o diff proposto.

### Fase 1 — Conexão: Express → Standard via OAuth
Substituir o onboarding por Account Links pelo **fluxo OAuth Connect** (o clube conecta a
própria conta Stripe). Atualizar a tela para um botão "Conectar Stripe" e o status da
conexão, deixando claro que o clube administra a própria conta. Continuar armazenando o
`account_id` e tratando `account.updated`; manter o **bloqueio de cobrança** até
`charges_enabled`/`payouts_enabled`. Definir o caminho de **reconexão** para qualquer
conta Express pré-existente.
**Pronto quando:** um clube conecta a própria conta Stripe via OAuth e o painel mostra
"pronto para receber".

### Fase 2 — Cobrança: destination → direct charges
Mover a criação de Customer, Subscription, PaymentIntent e Checkout Session para a **conta
conectada** (contexto `Stripe-Account`). Garantir que os fundos liquidem na conta do clube
e que reembolsos/disputas saiam do saldo do clube. Onde houver taxa de plataforma, usar
`application_fee_amount` nas direct charges (default 0).
**Pronto quando:** uma mensalidade e uma compra na loja, em modo teste, liquidam na conta
do clube via direct charge, com a taxa de plataforma (se ligada) indo para a Aura.

### Fase 3 — Webhooks: plataforma → eventos de contas conectadas
Passar a tratar **Connect webhooks** (eventos das contas conectadas), atribuindo cada
evento ao clube correto. Manter idempotência, o espelhamento em `Invoice`/`Payment`/
`Order` e o painel de "quem pagou / quem deve".
**Pronto quando:** pagamentos feitos na conta de um clube aparecem no Aura atribuídos ao
clube certo, sem ação manual.

### Fase 4 — Responsabilidade e UX
Remover qualquer configuração/suposição de responsabilidade da plataforma por saldos
negativos. Ajustar textos para deixar claro que o clube administra a própria conta Stripe
(disputas, reembolsos, painel).
**Pronto quando:** não há mais código assumindo liability da plataforma, e a UI comunica o
novo modelo.

### Fase 5 — Teste de regressão (modo teste Stripe)
Fluxo ponta a ponta: conectar um clube via OAuth, criar uma assinatura de mensalidade,
fazer um pedido na loja, simular um pagamento que falha e conferir reconciliação e
atribuição corretas. Garantir que catálogo, lembretes e inadimplência continuam
funcionando.
**Pronto quando:** o fluxo completo passa em modo teste sem regressões nas funcionalidades
que já existiam.

---

## Comece agora

Execute apenas a **Fase 0**: audite a implementação Stripe atual e me entregue o diff
exato para migrar a Express → Standard + direct charges. **Não altere código** e não
avance para a Fase 1 sem minha aprovação.
