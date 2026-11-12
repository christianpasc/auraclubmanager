# E-mails de autenticação (confirmação e senha)

A Aura envia os próprios e-mails de autenticação. O Supabase Auth não envia mais
nenhum e-mail na jornada normal.

## Por quê

Até aqui a confirmação de cadastro e a redefinição de senha saíam pelo Supabase:
marca dele, assunto dele, um idioma só, pelo serviço de e-mail embutido — que é
limitado a poucos envios por hora e não é para produção. Dois cadastros em
`auth.users` nunca confirmaram.

Além disso, a tela `/reset-password` não existia: `AuthContext.resetPassword`
mandava o usuário para uma rota que nunca foi registrada. Quem pedia nova senha
recebia o e-mail, clicava e chegava em lugar nenhum. O fluxo de senha nunca
funcionou de ponta a ponta.

## Como funciona agora

O cadastro entra direto no sistema. A confirmação é pedida por uma faixa
persistente (`components/EmailVerificationBanner.tsx`), não por uma tela de
bloqueio.

A fonte da verdade é **`profiles.email_verified_at`**, e não
`auth.users.email_confirmed_at`: com "Confirm email" desligado no Supabase, o
GoTrue preenche a coluna dele sozinho no cadastro, então ela deixa de significar
que alguém provou algo.

| Função | `verify_jwt` | Papel |
|---|---|---|
| `send-email-verification` | **true** | Envia a confirmação. Chamada no cadastro e no botão "reenviar". Throttle 1/min, 5/h. |
| `verify-email` | **false** | Alvo do link. Grava `email_verified_at`, consome o token e redireciona para `/?email_verified=1`. |
| `send-password-reset` | **false** | Gera o token com `admin.generateLink` e envia no nosso template. Sempre responde 200. Throttle 1/min, 3/h. |

Os tokens de confirmação ficam em `auth_email_tokens`, **só como SHA-256** —
uso único, validade de 24 h. O throttle fica em `auth_email_throttle`. As duas
tabelas têm RLS ligada e **nenhuma policy**, de propósito: só o service role
alcança.

### O link de senha e o HashRouter

O app roda em `HashRouter`. Se usássemos o `action_link` do Supabase, ele
acrescentaria `?code=` **fora** do fragmento, onde o cliente não consegue ler.
Por isso o link é montado por nós:

```
https://app.auraclubmanager.io/#/reset-password?token_hash=<hashed_token>&type=recovery
```

A tela `pages/auth/ResetPassword.tsx` troca esse `token_hash` por uma sessão com
`supabase.auth.verifyOtp({ type: 'recovery' })` e então chama `updateUser`.

### Trava de envio a terceiros

Confirmar o e-mail não limita o uso do sistema. Só três ações esperam a
confirmação, porque mandam mensagem para fora ou abrem conta bancária:
`send-invitations`, `send-invoice-email` e `asaas-create-subaccount`.

O guard está em `supabase/functions/_shared/callerGuard.ts` e faz **duas** coisas.
A segunda não era o pedido original, mas estava no caminho: as duas funções de
envio rodavam com service role e nunca conferiam **a qual tenant** o chamador
pertencia, só que havia um JWT válido. Qualquer usuário logado podia passar o id
de convite ou cobrança de outro clube e disparar e-mail no nome dele.

## Estado

Aplicado em 12/11/2026:

- **Migração** — `scripts/migration_auth_emails.sql` (idempotente). O backfill
  marcou 19 dos 21 perfis como confirmados; os 2 restantes são contas que de
  fato nunca confirmaram.
- **Funções** — as 6 no ar. `verify-email` (v1), `send-email-verification` (v1),
  `send-password-reset` (v1), `send-invitations` (v14), `send-invoice-email`
  (v11), `asaas-create-subaccount` (v14).

Se precisar reimplantar, as três novas importam de `_shared/`, e o deploy tem de
incluir esses arquivos — com a CLI isso é automático:

```bash
supabase functions deploy send-email-verification                  # verify_jwt padrão (true)
supabase functions deploy verify-email        --no-verify-jwt
supabase functions deploy send-password-reset --no-verify-jwt
```

`verify-email` e `send-password-reset` **precisam** de `--no-verify-jwt`: a
primeira é aberta de um cliente de e-mail, a segunda por quem não consegue
entrar. Com JWT obrigatório, as duas quebram.

## O que falta executar

### 1. Painel do Supabase

1. **Authentication → Providers → Email → desligar "Confirm email".** É o que
   faz o cadastro já vir com sessão.
2. **Authentication → Emails → SMTP Settings → Resend** —
   `smtp.resend.com:465`, usuário `resend`, senha = `RESEND_API_KEY`, remetente
   `noreply@auraclubmanager.io`. Depois do item 1 o Supabase não envia mais nada
   na jornada normal, mas isto continua valendo como rede de segurança (convite
   de equipe, troca de e-mail) e tira o teto de poucos envios por hora.
3. **Authentication → Rate Limits** — subir o limite horário de e-mail para algo
   compatível com o plano do Resend.

A ordem entre código e painel não importa: `signUp` tem fallback para
`signInWithPassword`, então funciona com "Confirm email" ligado ou desligado.

### 2. Frontend na VPS

O build do frontend precisa subir — a faixa de aviso, a tela de senha e o
cadastro direto são todos client-side.

## Secrets

Nenhum novo. `RESEND_API_KEY` e `APP_BASE_URL` já existem (o segundo com default
`https://app.auraclubmanager.io`).
