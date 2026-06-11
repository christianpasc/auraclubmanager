# Prompt — Camada 1 (funcionalidades-base) do Aura Club Manager

> Cole o conteúdo abaixo no Antigravity. Ele já instrui o agente a inspecionar
> seu repositório antes de codar, então não precisa adaptar o stack manualmente.

---

## Contexto

Você é meu engenheiro de software para o **Aura Club Manager**, um SaaS multi-tenant
de gestão de clubes e escolinhas de futebol (cada clube/escola é um tenant isolado).
Os usuários finais são donos de escola, coordenadores, treinadores, atletas e
responsáveis (pais). Vamos construir a **Camada 1**: o conjunto de funcionalidades
consideradas obrigatórias no mercado (paridade com 360Player, TeamSnap, Spond e
Pitchero). NÃO implemente nada de desenvolvimento de atleta/vídeo/avaliação nesta etapa
— isso é uma camada futura.

## Regras de trabalho (importante)

1. **Antes de escrever qualquer código**, inspecione o repositório e me responda:
   - Qual stack está em uso (linguagem, framework, banco, ORM, auth)?
   - Existe estrutura multi-tenant? Como?
   - O que já existe vs. o que falta para a Camada 1?
   Se o projeto estiver vazio/greenfield, **proponha** um stack e aguarde minha aprovação.
   Sugestão padrão caso eu não tenha preferência: backend e front em TypeScript,
   PostgreSQL com migrações versionadas, RBAC próprio e camada de pagamento abstraída
   atrás de uma interface (provider plugável).
2. **Não toque na landing page WordPress/Elementor existente.** Ela é separada do app.
3. Trabalhe **fase por fase**. Ao fim de cada fase, pare, mostre o que entregou e
   aguarde meu "ok" antes de avançar. Não tente fazer várias fases de uma vez.
4. **Proponha um plano antes de codar cada fase** (arquivos que vai criar/alterar,
   migrações, endpoints).
5. **Pergunte antes de qualquer operação destrutiva** (drop de tabela, migração
   irreversível, reset de dados).
6. Escreva **testes** para a lógica de negócio (cobrança recorrente, cálculo de
   inadimplência, permissões) e faça **commits pequenos e descritivos por fase**.
7. Código (identificadores, tabelas, funções) em **inglês**; textos voltados ao
   usuário em **português do Brasil**, mas já preparados para i18n.
8. **LGPD e dados de menores**: a maioria dos atletas é criança. Modele consentimento
   do responsável, minimize dados sensíveis e registre quem acessa o quê. Trate isso
   como requisito, não como extra.

---

## Modelo de dados (entidades centrais da Camada 1)

Implemente, respeitando o isolamento por tenant (`organization_id` em tudo):

- **Organization** — o clube/escola (tenant). Plano de assinatura, dados fiscais, slug
  público para o link de matrícula.
- **User** — credencial de login. Um usuário pode ter papéis em uma ou mais organizações.
- **Role / Permission (RBAC)** — papéis: `owner`, `coordinator`, `coach`, `guardian`,
  `athlete`. Permissões granulares por papel.
- **Season** — temporada/ano letivo (categorias e turmas pertencem a uma season).
- **AgeCategory** — sub-7, sub-9, etc. (regra por data de nascimento).
- **Group / Team / Class (turma)** — agrupamento de atletas; pertence a uma categoria
  e tem treinador(es) associados.
- **Athlete** — o aluno/jogador. Vinculado a responsável(is), categoria e turma.
- **Guardian** — responsável. **Um responsável gerencia vários atletas** numa única conta.
- **Plan** — plano de mensalidade (Starter/Pro/Enterprise no nível do SaaS; e os planos
  de mensalidade que a *escola* cobra dos alunos — modele os dois claramente separados).
- **Invoice / Charge** — cobrança gerada (única ou recorrente), com status
  (pendente, paga, vencida, cancelada).
- **Payment** — registro de pagamento (online ou manual/dinheiro), ligado à Invoice.
- **Event** — treino, jogo ou evento; com data, local, turma/categoria-alvo.
- **Attendance / RSVP** — confirmação de presença e registro de presença efetiva.
- **Message / Announcement** — comunicados e mensagens (grupo e individuais).
- **Notification** — entrega multicanal (push/email; deixe hook para SMS/WhatsApp).

---

## Escopo por fase

### Fase 0 — Fundação
Multi-tenancy, autenticação, RBAC com os 5 papéis, modelo de dados acima com migrações,
e seeds de exemplo (1 escola, 2 turmas, alguns atletas e responsáveis) para teste.
**Pronto quando:** consigo logar como cada papel e ver apenas os dados do meu tenant.

### Fase 1 — Cadastro e estrutura
CRUD de Season, AgeCategory, Group/Turma, Athlete e Guardian, com o vínculo
responsável→vários atletas e a **auto-atribuição de categoria por data de nascimento**.
Listagens com busca/filtro por turma, categoria e status.
**Pronto quando:** consigo montar a estrutura completa de uma escola pela interface.

### Fase 2 — Matrícula online (self-service)
Formulário público de matrícula com **campos customizáveis pela escola**, acessível por
um **link único por escola** (usar o slug da Organization). O fluxo cria o responsável e
o(s) atleta(s), coleta consentimento LGPD e já direciona para o plano de mensalidade.
Inspiração: deve ser tão simples que o pai conclua em poucos minutos sem ligação.
**Pronto quando:** um responsável se matricula do zero por um link, sem login prévio.

### Fase 3 — Financeiro
Planos de mensalidade da escola; geração de **cobranças recorrentes**; **abstração de
provider de pagamento** (interface única, com pelo menos um provider real plugado —
suporte a cartão recorrente para mercado internacional e, idealmente, PIX/boleto para o
Brasil); registro de pagamento manual; **painel de inadimplência** mostrando exatamente
quem está em atraso; **lembretes automáticos** de cobrança.
**Pronto quando:** gero mensalidades de uma turma, marco uma como paga, e vejo a lista
de inadimplentes com lembrete disparado.

### Fase 4 — Agenda e presença
Eventos (treino/jogo) com calendário por turma/categoria; **feed de calendário
exportável (iCal) e sincronização externa**; **RSVP/disponibilidade** por evento;
**registro de presença** efetiva pelo treinador.
**Pronto quando:** crio um treino recorrente, o responsável confirma presença, e o
treinador registra quem compareceu.

### Fase 5 — Comunicação
Comunicados em massa por turma/categoria/escola; mensagens em grupo e individuais;
entrega por **push e e-mail** com hook pronto para SMS/WhatsApp.
**Pronto quando:** envio um comunicado para uma turma e os responsáveis recebem
notificação.

### Fase 6 — Perfis e responsividade
Garantir que cada papel (gestor/treinador/responsável/atleta) tenha uma visão adequada
e que toda a interface seja **responsiva/mobile-first** (a maioria dos pais usa celular).
**Pronto quando:** uso o app confortavelmente no celular em cada um dos perfis.

---

## Comece agora

Execute apenas a **Fase 0**: inspecione o repositório, me diga o stack atual e o estado
do projeto, proponha o plano da Fase 0 (arquivos, migrações, libs) e aguarde meu "ok"
antes de codar. Não avance para a Fase 1 sem minha confirmação.
