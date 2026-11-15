# Leads do período de teste no DeskcommCRM

A Aura envia cada lead do teste para o DeskcommCRM por webhook assinado, em
três momentos do ciclo de vida, e **somente** para quem consentiu contato por
WhatsApp.

## O que isto não faz

Não muda nada no acesso. O cadastro continua devolvendo sessão, cai direto no
wizard de onboarding e o teste de 7 dias começa na hora. Ninguém espera por
vendedor, por fila ou por webhook.

No momento do cadastro, o que acontece pelo CRM é **uma linha numa tabela**.
Quem conversa com o DeskcommCRM é outro processo, por fora. Se o CRM ficar fora
do ar um dia inteiro, os cadastros seguem normais e a fila só acumula.

## Os três momentos

| Estágio | Quando | Como é detectado |
|---|---|---|
| `Em teste` | cadastro concluído | gatilho `crm_enqueue_on_signup_trigger` em `profiles` |
| `Assinou` | `subscription_status` vira `active` | gatilho em `tenants` |
| `Teste encerrado` | cancelou, ou o teste venceu sem assinar | o mesmo gatilho, e a varredura diária |

O `external_id` é o **id do usuário** (`auth.users.id`), não do clube: no
cadastro o clube ainda não existe — ele só nasce depois, pela RPC
`create_own_tenant`. Os dois estágios seguintes são do clube e voltam ao
usuário pelo dono (`tenant_users.is_owner`), o mesmo caminho que
`get_trial_email_targets()` já usa.

As duas trilhas de pagamento gravam `tenants.subscription_status`
(`stripe-webhook` e `asaas-webhook`), então observar essa coluna cobre Stripe e
Asaas **sem que nenhuma das duas funções saiba que o CRM existe**.

### Quem se cadastra e nunca cria clube

Os dois estágios de saída são do clube, então esses leads ficariam em
`Em teste` para sempre. A varredura `enqueue_crm_trial_endings()` fecha o caso
depois dos mesmos 7 dias que o teste teria durado.

## A fila

`public.crm_outbox` guarda **o que aconteceu**, nunca o corpo. O corpo é
montado na hora do envio, com nome, telefone e e-mail atuais — é o que o CRM
quer, e é o que deixa a montagem testável fora do banco.

`UNIQUE (user_id, stage)` garante que cada estágio chega ao CRM no máximo uma
vez, sem depender da deduplicação do CRM. De passagem, limita a tabela a 3
linhas por lead, e é por isso que não existe rotina de limpeza para ela.

RLS ligada e **nenhuma policy**, de propósito: só service role alcança. Mesmo
formato de `auth_email_tokens` e `trial_emails`.

### Retentativa

`1m → 5m → 15m → 1h → 4h → 12h → 24h`, desistindo na 8ª tentativa.

- `2xx` → `sent`
- `429`, `5xx`, timeout e falha de rede → segue `pending`
- qualquer outro `4xx` → `failed` na hora; corpo recusado não melhora com
  repetição
- sem consentimento ou sem contato na hora do envio → `skipped`

A reclamação do lote usa `FOR UPDATE SKIP LOCKED` e adia a linha **antes** de a
requisição sair, então duas execuções sobrepostas nunca enviam a mesma coisa
duas vezes.

## A assinatura

Header `X-Deskcomm-Signature`: HMAC-SHA256 em hexadecimal do corpo bruto, com
`DESKCOMM_WEBHOOK_SECRET` como chave.

O corpo é serializado **uma vez** e a mesma string é assinada e enviada. Isso
não é detalhe: passar o objeto para o `fetch` e deixar ele serializar de novo
pode mudar ordem de chaves ou espaçamento, e aí o CRM calcula outro digest e
recusa um corpo perfeitamente válido. O teste
`_shared/crmSignature.test.ts` fixa exatamente esse caso.

## Consentimento

Fica em `profiles` porque é dado pessoal, não do clube:

- `ai_contact_consent_at` — quando aceitou
- `ai_contact_consent_version` — o texto aceito (`constants/consent.ts`)

A versão existe para que reescrever a caixa depois **não mude o que um lead
antigo concordou**. Ao alterar o texto em qualquer idioma, suba
`AI_CONSENT_VERSION`.

Desde 15/11/2026 (`aura-trial-2026-11-v2`) **não existe caixa separada**: a
frase do WhatsApp faz parte da mesma sentença da política de privacidade, que é
obrigatória para criar a conta. Logo, todo cadastro novo consente, e `v1` e `v2`
não querem dizer a mesma coisa — `v1` foi marcado por escolha, `v2` veio junto
do aceite. É para guardar essa diferença que a versão existe.

Em `aura-trial-2026-11-v3`, ainda em 15/11/2026, saiu o trecho "inclusive por
um assistente virtual". O texto passa a avisar sobre contato por WhatsApp, mas
não sobre o contato ser automatizado. **Só `v1` e `v2` trazem esse aviso** — o
campo `ai_service_consent` do corpo continua com o nome que o CRM espera, mas
de `v3` em diante ele não representa mais um consentimento informado de IA.

Vale saber o que isso custa: consentimento embutido num aceite obrigatório não
é separável, e a LGPD (art. 8º, §4º) trata consentimento para finalidade
específica como algo que deveria ser. Foi uma decisão consciente para reduzir
atrito no cadastro. Voltar atrás é restaurar a segunda caixa e subir a versão
de novo.

A checagem acontece em **dois** lugares: `enqueue_crm_event` não enfileira sem
consentimento e sem telefone, e `buildPayload` confere outra vez na saída — o
que faz um consentimento retirado depois de enfileirado ainda assim parar o
envio.

**Nada é retroativo.** Os 16 clubes que já existiam nunca consentiram e não vão
ao CRM.

## Telefone

Obrigatório no cadastro, normalizado para E.164 por `utils/phone.ts`. Brasil é
o padrão: `(11) 98765-4321` vira `+5511987654321`. Quem digita código de país
explícito é aceito como digitou, porque o cadastro é servido em 5 idiomas e
recusar `+351` ou `+1` afastaria os cadastros internacionais.

Fixo aqui como aviso: **campo obrigatório novo no formulário custa conversão.**
Foi uma decisão consciente — sem telefone não há WhatsApp, e sem WhatsApp o CRM
não serve para muito.

## UTM

Nada capturava UTM antes. `utils/utm.ts` captura de primeiro toque na carga do
app (`index.tsx`) e guarda em `localStorage`; a primeira visita que trouxer
atribuição é a que conta.

**Os links da landing precisam dos parâmetros antes do `#`**, porque o app usa
HashRouter:

```
app.auraclubmanager.io/?utm_source=google&utm_campaign=escolinhas#/signup
```

A forma com hash (`#/signup?utm_source=...`) também é lida, por segurança. Sem
isso, os três campos simplesmente não existem no corpo — e não vão como `null`,
vão ausentes.

## Configuração

Dois segredos nas Edge Functions:

- `DESKCOMM_WEBHOOK_URL`
- `DESKCOMM_WEBHOOK_SECRET`

Nenhuma URL e nenhum segredo no código. O token de cron reusa o
`TRIAL_CRON_TOKEN` que já existe, de propósito: segredo faltando foi o que
deixou o trilho de dunning silencioso por semanas.

**Enquanto os dois não existirem**, a função responde 503 e **não encosta nas
linhas** — a fila espera intacta em vez de queimar tentativas contra uma URL
que não está lá. E o cron só chama a função quando há linha pendente
(`WHERE EXISTS` no comando agendado), então não há 503 de minuto em minuto.

## Agendamentos

| Job | Quando | O quê |
|---|---|---|
| `crm-outbox-drain` | a cada minuto, se houver fila | POST para a função |
| `crm-trial-endings-daily` | 11:05 UTC | `enqueue_crm_trial_endings()`, SQL direto |

Lote de 40 por execução: o CRM aceita 60 requisições por minuto por fonte.

## Testes

```bash
npm run test:functions
```

12 testes. O vetor de HMAC é calculado por fora (node `crypto.createHmac`), não
pelo próprio código — então ele fixa o digest, não "o que a nossa função
produz".

## Estado

Aplicado em 13/11/2026.

- **Migração** — `scripts/migration_crm_deskcomm.sql` (idempotente). 3 colunas
  novas em `profiles`, `crm_outbox` com RLS e 0 policies, 2 gatilhos ativos,
  2 jobs de cron ativos.
- **Função** — `crm-outbox-drain` v1, `verify_jwt: false`.

Verificado no banco de produção:

- dono de clube real sem consentimento → `enqueue_crm_event` devolve `false`
- `enqueue_crm_trial_endings()` sobre os 16 testes vencidos → **0 enfileirados**
- com consentimento e telefone, `subscription_status` indo para `active`
  produziu `Em teste -> pending | Assinou -> pending`; o ensaio inteiro foi
  desfeito e a fila voltou a zero
- função sem token e com token errado → `401`

**Falta:** os dois segredos, e o envio real para o CRM nunca aconteceu.
