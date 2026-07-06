# Prompt — Provider Asaas (Brasil) atrás da abstração de pagamento — Aura Club Manager

> Cole no Antigravity. Pré-requisito: a **abstração de provider de pagamento já existe** e o
> **Stripe já está implementado** atrás dela. Objetivo: adicionar o **Asaas** como provider
> para o **Brasil**, sem quebrar o Stripe. Trabalhe fase por fase.

---

## Contexto

Aura Club Manager: SaaS multi-tenant de gestão de clubes/escolinhas de futebol. Já existe
uma **interface única de provider de pagamento**, com o **Stripe** implementado atrás dela
(modelo internacional). Agora quero adicionar o **Asaas** como provider do **Brasil**.

**Decisões já tomadas (não reabrir):**
- **No Brasil, usar Asaas** (não Stripe). O Stripe permanece para o **internacional** (fase
  2). Roteamento por mercado/país do clube.
- **Modelo: subconta padrão** do Asaas (NÃO White Label). Cada escolinha tem a **própria
  subconta**, com acesso ao próprio painel Asaas para saque — **eu NÃO quero construir tela
  de saque**.
- **Conta-raiz** = a conta Asaas da minha empresa nova (CNPJ só meu). A API key dela vem por
  variável de ambiente/secret — **nunca** hardcoded.
- **NFS-e**: construir o ponto de integração, mas **desligado por feature flag** por enquanto.

**Dois contextos de cobrança:**
1. **Aura cobra o plano da escolinha** (Aura Club R$ 97/197 etc.) → pela **conta-raiz**.
2. **Escolinha cobra os alunos** (mensalidades) → pela **subconta da escolinha**; o dinheiro
   cai na subconta dela (nunca na conta-raiz), e ela saca pelo painel Asaas próprio.

## Fatos técnicos do Asaas a respeitar

- Criação de subconta é via **API (POST /v3/accounts)** e só para **conta-raiz PJ (CNPJ)**.
- Na criação, o Asaas retorna **apiKey (só uma vez!)** e **walletId**. **Armazene a apiKey
  imediatamente e criptografada**, associada ao clube; nunca a exiba em logs/telas. O
  walletId serve para split/transferências futuras.
- **incomeValue** (faturamento/renda) e **cpfCnpj** são obrigatórios na criação da subconta.
- **Período de avaliação regulatória (BACEN):** a partir da 1ª subconta via API, limite de
  **10 subcontas de titulares diferentes** e **R$ 2.000 em cobranças por subconta**, por até
  **60 dias**, até concluir a checagem. O sistema deve **lidar com esses limites com
  elegância** (mensagem clara se a criação/cobrança for bloqueada), **não quebrar**.
- Meios: **PIX, boleto e cartão**; suporta **assinatura/cobrança recorrente**.
- **Subconta padrão**: o titular recebe e-mail de boas-vindas do Asaas e acessa o próprio
  painel — então **não** construa gestão de saque.
- **Webhooks** por subconta (e na conta-raiz) para eventos de pagamento.
- **NFS-e**: o Asaas emite; construir o gancho, mas atrás de flag desligada.

## Regras de trabalho

1. **Antes de codar**, inspecione o repo (Fase 0) e me traga o plano.
2. **Reuse a abstração existente.** Implemente o Asaas como **provider concreto irmão do
   Stripe**, sem tocar no domínio nem duplicar lógica. **Não quebre o Stripe/internacional.**
3. **Nunca trafegue/armazene dados de cartão** — use os recursos do Asaas (checkout/
   tokenização). Guarde só IDs e a apiKey criptografada.
4. Trabalhe **fase por fase**; pare e aguarde meu "ok".
5. **Pergunte antes de operações destrutivas.** Escreva **testes** no **sandbox do Asaas**.
   Commits pequenos por fase.
6. Código em **inglês**; textos ao usuário em **português do Brasil**.
7. **LGPD/segurança**: criptografar credenciais, não logar dados sensíveis, cuidado com
   dados de menores já definido nas camadas anteriores.

## Mapeamento de domínio → Asaas

- **Clube (tenant) BR** → **subconta Asaas** (id + apiKey criptografada + walletId).
- **Aura (plataforma)** → **conta-raiz Asaas** (empresa nova).
- **Guardian/pagador** → cliente na subconta da escolinha.
- **Plano de mensalidade / assinatura** → cobrança recorrente do Asaas.
- **Invoice/Payment do Aura** → espelho dos eventos do Asaas, atualizado por webhook.

---

## Escopo por fase

### Fase 0 — Reconhecimento
Inspecione a **abstração de pagamento** e como o **Stripe** está implementado atrás dela;
confirme as entidades (`Organization`/clube, `Plan`, `Invoice`, `Payment`, `Guardian`,
`Athlete`), onde ficam credenciais/segredos, e como fazer o **roteamento por mercado**
(Brasil→Asaas, internacional→Stripe). Proponha o plano. **Não codifique ainda.**
**Pronto quando:** eu aprovar o plano e o roteamento.

### Fase 1 — Provider Asaas (base) + roteamento
Implemente o **Asaas como provider concreto** atrás da interface existente, e o
**roteamento por país/moeda** (BR→Asaas, resto→Stripe). Configure ambiente **sandbox** e a
**conta-raiz** por secret. Sem cobrança real ainda — só a base e o roteamento.
**Pronto quando:** um clube BR resolve para Asaas e um internacional para Stripe, sem
quebrar nada.

### Fase 2 — Cobrança dos planos do Aura (conta-raiz)
Cobrança **recorrente** dos planos do Aura (R$ 97/197 etc.) pela **conta-raiz** via
PIX/boleto/cartão; refletir status em `Invoice`/`Payment`.
**Pronto quando:** uma escolinha BR assina um plano e o pagamento aparece no Aura.

### Fase 3 — Criação de subconta por escolinha (subconta padrão)
No onboarding de clube BR, **criar a subconta Asaas via API** (com `cpfCnpj`, `incomeValue`
e demais campos obrigatórios); **armazenar id + apiKey criptografada + walletId**; **bloquear
a cobrança de membros** até a subconta estar apta; **tratar com elegância os limites do
período de avaliação regulatória** (10 subcontas / R$ 2.000 / 60 dias) com mensagem clara.
**Pronto quando:** cadastro uma escolinha BR e ela ganha uma subconta Asaas pronta para
receber, com as credenciais guardadas com segurança.

### Fase 4 — Cobrança dos membros (na subconta)
A escolinha cobra as **mensalidades** dos alunos pela **própria subconta** (PIX/boleto/
cartão, recorrente); o dinheiro liquida na **subconta da escolinha**; refletir status no
Aura. **Não** construir tela de saque (a escolinha usa o painel Asaas).
**Pronto quando:** uma mensalidade é cobrada e liquida na subconta da escolinha, visível no
Aura.

### Fase 5 — Webhooks e reconciliação
Webhooks com **verificação**, tratando eventos da **conta-raiz** (planos) e de **cada
subconta** (membros), **atribuindo ao clube certo**; atualização **idempotente** de
`Invoice`/`Payment`; painel de **quem pagou / inadimplência**.
**Pronto quando:** pagamentos (plano ou mensalidade) aparecem no Aura sem ação manual,
atribuídos ao clube correto.

### Fase 6 — NFS-e (preparado, desligado)
Construa o ponto de integração de **emissão de NFS-e** do Asaas atrás de um **feature flag
DESLIGADO** por padrão, pronto para ligar depois.
**Pronto quando:** o código de NFS-e existe, testado em sandbox, mas inativo por flag.

---

## Comece agora

Execute apenas a **Fase 0**: inspecione a abstração e o Stripe existentes, confirme as
entidades e o roteamento, e me apresente o plano. **Não codifique** e não avance sem minha
aprovação.
