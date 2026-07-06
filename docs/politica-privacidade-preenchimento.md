# Política de Privacidade — valores para preencher os placeholders

Preenchido com base no que está realmente implementado e configurado no
sistema em 28/06/2026 (região do Supabase e ausência de widget de chat
confirmadas direto no projeto). Os campos da empresa e de responsáveis só
você pode preencher — estão marcados como **[VOCÊ PREENCHE]**.

## Dados da empresa

| Placeholder | Valor |
|---|---|
| `[COMPANY_LEGAL_NAME]` | **CHRISTIAN OTAVIO PASCHOALOTTO LTDA** — razão social oficial |
| `[FULL_REGISTERED_ADDRESS]` | **Rua Barão do Rio Branco, 566** |
| `[CITY]` | **Santo Anástácio-SP** |
| `[COUNTRY]` | **Brasil** |
| `[DATE]` | June 28, 2026 |

## Contatos e responsáveis

| Placeholder | Valor |
|---|---|
| `[PRIVACY_EMAIL]` | **privacy@auraclubmanager.io** — sugestão: `privacy@auraclubmanager.io` (criar a caixa antes de publicar; é o canal citado nas seções 1, 9 e nos Adendos B/C) |
| `[DPO_NAME_AND_CONTACT]` | **** — ou `Not formally appointed` enquanto não designar |
| `[REPRESENTATIVE_NAME_AND_ADDRESS]` | `N/A` (a menos que você contrate um representante Art. 27 na UE/UK — só obrigatório com oferta ativa/monitoramento de titulares na EEA/UK) |
| `[NAME_OR_TITLE]` (Canadá) | **Founder** — pode ser um cargo (ex.: "Founder / Privacy Officer") |
| `[NAME]` (África do Sul) | **Founder** — só relevante se tiver clientes na África do Sul; caso contrário pode declarar não aplicável |

## Fornecedores / infraestrutura (confirmado no sistema)

| Placeholder | Valor |
|---|---|
| `[HOSTING_PROVIDER]` | **Supabase** (infraestrutura AWS) — banco de dados, autenticação, armazenamento de arquivos e funções serverless |
| `[HOSTING_PROVIDER > LOCATION]` | **USA (AWS us-west-2, Oregon)** — confirmado no projeto |
| `[EMAIL_PROVIDER]` | **Resend** — apenas e-mail transacional (convites, cobranças de mensalidade, convocações de jogo); não há e-mail de marketing |
| `[EMAIL_PROVIDER > LOCATION]` | **USA** |
| `[ANALYTICS_TOOL]` | **Not used** — o app não tem nenhuma ferramenta de analytics nem rastreadores; remover a linha da tabela de suboperadores e ajustar a seção de cookies |
| `[ANALYTICS_TOOL > LOCATION]` | N/A |
| `[CONSENT_TOOL]` | **Banner próprio do aplicativo** (in-app) — usado exclusivamente para o opt-in do widget de chat de terceiros. Não há ferramenta externa (Cookiebot etc.) nem necessidade: os únicos cookies/armazenamento são estritamente necessários (sessão de login e preferências de idioma/moeda) |
| `[SUPPORT_TOOL]` | **Nenhum configurado atualmente** (confirmado no sistema). A plataforma suporta ativar um widget de chat (Crisp/Tawk.to/etc.) que só carrega com consentimento do visitante — se ativar um no futuro, atualizar a política com o nome e o país do provedor |
| `[SUPPORT_TOOL > LOCATION]` | N/A por enquanto |
| `[THIRD_PARTY_ASSESSOR]` | `qualified internal team` — não há empresa de pentest contratada |

Suboperador adicional que já consta na política e está correto:
**Stripe** (pagamentos, EUA, com Cláusulas Contratuais Padrão para UE).

## Períodos de retenção (alinhados ao que o sistema executa)

| Placeholder | Valor implementado / sugerido |
|---|---|
| `[X months/years]` — dados de conta após cancelamento | **90 days** — o job diário enfileira o clube encerrado há +90 dias para exclusão definitiva (executada pela equipe no painel admin). Se quiser margem operacional maior, declare `up to 12 months` — mas 90 dias é o que está automatizado |
| `[7 years]` — registros de cobrança | **7 years** — ok manter. Os registros ficam no Stripe (obrigações fiscais); as faturas internas do app são excluídas junto com o clube |
| `[24 months]` — analytics agregado | Como não há analytics, esta linha pode sair. Se quiser manter algo equivalente: o log de auditoria administrativa é purgado automaticamente em **24 months** |
| `[13 months]` — dados IP brutos | Não coletamos IPs. O equivalente real: logs de acesso a vídeos (auditoria LGPD interna) purgados automaticamente em **13 months**. Reformular a linha nesse sentido ou remover |
| `[3 years]` — comunicações de suporte | **3 years** — ok como compromisso; hoje não há ferramenta de suporte armazenando conversas (e-mails de suporte ficam na sua caixa de e-mail) |
| `[90 days]` — dados de membros após encerramento | **90 days** — confirmado; é exatamente o que o job de retenção + fila de exclusão implementam |
