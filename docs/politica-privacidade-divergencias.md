# Política de Privacidade — divergências a corrigir no site

Lista do que precisa ser ajustado no texto publicado em
`auraclubmanager.io/politica-privacidade/` para que ele reflita o que o
sistema realmente faz (após as mudanças de adequação implementadas no app
em 28/06/2026). O texto do site é editado fora deste repositório — este
arquivo é só o guia de correção.

## 1. Placeholders não preenchidos (crítico — o texto publicado está incompleto)

| Placeholder no texto | Valor real a preencher |
|---|---|
| `[EMAIL_PRIVACIDADE]` | Definir e publicar um e-mail real (ex.: privacidade@auraclubmanager.io) — ele também é citado nos Adendos B e C |
| `[PROVEDOR_HOSPEDAGEM]` / `[LOCALIZAÇÃO]` | Supabase (infraestrutura AWS). Confirmar a região do projeto no painel do Supabase e citar (ex.: AWS us-east-1, EUA) |
| `[PROVEDOR_EMAIL]` | Resend (EUA) — usado apenas para e-mail transacional (convites, cobranças, convocações). Não há e-mail de marketing |
| `[FERRAMENTA_ANALYTICS]` | **Não utilizamos** — remover a linha da tabela de suboperadores e ajustar a seção 5 (ver item 3 abaixo) |
| `[FERRAMENTA_SUPORTE]` | O widget de chat é configurável (Crisp/Tawk.to/etc.). Citar o provedor efetivamente ativado, ou declarar "widget de chat de terceiros, ativado somente com consentimento do visitante" |
| `[FERRAMENTA_CONSENTIMENTO]` | Não usamos ferramenta externa — o consentimento do chat é um banner próprio do app. Ajustar o texto (ver item 3) |
| `[X meses/anos]`, `[5 anos]`, `[24 meses]`, `[13 meses]`, `[3 anos]`, `[90 dias]` | Preencher com os prazos reais implementados (ver item 4) |
| `[NOME_DO_RESPONSÁVEL]` (Adendo C) / `[NOME]` (Adendo D — POPIA) | Nomear o responsável pela privacidade |

## 2. Seção 3.1 — dados de uso que NÃO coletamos

O texto declara coleta de "IP, navegador, páginas, duração da sessão" e
"cookies e analytics". **O app não tem nenhuma ferramenta de analytics nem
coleta esses dados de navegação.** Corrigir para refletir a realidade:

- Coletamos: identificadores (nome, e-mail, idioma), credenciais (senha
  criptografada pelo Supabase Auth), dados de faturamento via Stripe,
  comunicações de suporte.
- Logs de infraestrutura (IP em logs de servidor do Supabase) existem apenas
  como registro técnico do provedor de hospedagem — se quiser manter a
  menção, reformular nesse sentido.

## 3. Seção 5 — Cookies

O texto promete banner de consentimento de cookies (opt-in EEE/UK) e suporte
a Global Privacy Control. A realidade do app:

- **Cookies/armazenamento estritamente necessários apenas**: sessão do
  Supabase Auth + preferências funcionais em localStorage (idioma, moeda,
  estado do menu). Nenhum cookie de analytics ou marketing. Para essa
  categoria, nenhum consentimento é exigido por lei — o texto pode declarar
  isso diretamente.
- **Widget de chat de terceiros**: agora só carrega após consentimento
  explícito do visitante (banner próprio, opt-in, recusa persistida).
  Descrever assim na política.
- Remover a promessa de `[FERRAMENTA_CONSENTIMENTO]` externa e a menção a
  GPC, ou reformular: "não utilizamos rastreadores sujeitos a GPC".

## 4. Seção 8 — Prazos de retenção (alinhar aos jobs implementados)

| Item do texto | Valor implementado no sistema |
|---|---|
| Analytics agregados / IPs brutos | Não coletamos analytics. Logs de acesso a vídeo (auditoria LGPD interna): **13 meses** (purga mensal automática) |
| Registros de auditoria administrativa | **24 meses** (purga mensal automática) |
| Dados de membros após encerramento da assinatura | **90 dias**: um job diário enfileira o clube encerrado há +90 dias para exclusão definitiva, executada pela equipe no painel admin |
| Registros de cobrança | Ficam no Stripe conforme obrigações fiscais (5 anos é razoável de declarar); faturas internas são excluídas junto com o clube |
| Dados de conta / suporte | Definir e preencher (sugestão: conta enquanto ativa + até exclusão processada; suporte 3 anos se usar ferramenta externa) |

## 5. Seção 9 — Direitos do titular (agora suportados pelo app)

O app agora oferece, e o texto pode citar:
- **Acesso/Portabilidade**: exportação de todos os dados do clube em JSON
  (Configurações → Segurança → Privacidade e Dados) e das mensalidades em CSV.
- **Eliminação**: solicitação de exclusão de conta ou do clube inteiro
  dentro do app; processamento pela equipe (painel admin) com trilha de
  auditoria. Manter o prazo de resposta de 15 dias úteis declarado.
- **Correção**: edição direta pelos formulários do app (já existia).

## 6. Seção 10 — Menores (agora suportado pelo app)

O item 10.3 ("consentimento documentado para vídeos/imagens") já era
verdadeiro; agora também vale para o **cadastro** do atleta menor: o app
bloqueia o registro de menores de 18 sem a confirmação de consentimento do
responsável legal, gravando quem confirmou e quando. O texto pode citar que
a plataforma oferece esse instrumento ao clube (o clube segue como
controlador responsável por obter o consentimento real).

## 7. Aceite da política (base contratual)

O cadastro agora exige o aceite explícito da Política de Privacidade
(checkbox com link), com data/hora registrada no perfil do usuário
(`profiles.privacy_accepted_at`). A seção 13 (alterações com 30 dias de
aviso) segue sendo um compromisso operacional — ao alterar a política de
forma material, enviar o e-mail com antecedência conforme prometido.

## 8. Compromissos que seguem sendo organizacionais (não resolvidos por código)

- Nomear DPO/encarregado e publicar o contato (seções 1 e 9).
- Disponibilizar o DPA (Contrato de Tratamento de Dados) citado na seção 2.2
  para os clubes assinarem.
- Procedimento de resposta a incidentes com notificação às autoridades
  (seção 11) — documentar internamente.
- Representante na UE/UK (Adendo A), se aplicável ao volume de clientes.
