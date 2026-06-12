# Prompt — Camada 2 (diferenciais operacionais) do Aura Club Manager

> Cole o conteúdo abaixo no Antigravity. Pré-requisito: a **Camada 1** já deve estar
> implementada. Este prompt instrui o agente a construir SOBRE o que já existe.

---

## Contexto

Você é meu engenheiro de software para o **Aura Club Manager**, SaaS multi-tenant de
gestão de clubes e escolinhas de futebol (cada clube/escola é um tenant isolado).
A **Camada 1** (cadastro, matrícula online, financeiro, agenda/presença, comunicação,
perfis) já foi construída. Agora vamos construir a **Camada 2**: os diferenciais
operacionais que ajudam o Aura a se destacar dos concorrentes (360Player, TeamSnap,
Pitchero). NÃO implemente desenvolvimento de atleta/vídeo/avaliação técnica — isso é a
Camada 3, futura.

## Regras de trabalho (importante)

1. **Antes de escrever qualquer código**, inspecione o repositório e me responda:
   - Confirme que a Camada 1 está implementada e quais entidades já existem
     (Organization, User/RBAC, Season, AgeCategory, Group/Team, Athlete, Guardian,
     Plan, Invoice/Payment, Event, Attendance, Message, Notification).
   - Onde está a **abstração de provider de pagamento** criada na Camada 1? A Camada 2
     (loja, patrocínios, reserva paga) deve **reusar essa mesma interface**, não criar
     outra.
   - Onde está o **slug público da Organization** e o fluxo de matrícula? O site do
     clube (Fase 1) e tudo que é público deve se apoiar nisso.
   Se algo da Camada 1 estiver faltando, me avise antes de prosseguir.
2. **Não toque na landing page WordPress/Elementor existente.** Atenção: o "site do
   clube" desta Camada 2 é um **microsite público por tenant dentro do SaaS** — coisa
   diferente da minha landing page de marketing. Não confunda nem mexa no WordPress.
3. **Reuse, não duplique.** Auto-organização por faixa etária e RBAC já existem na
   Camada 1 — não recrie. Uma "partida" é um tipo de **Event** que já existe; estenda,
   não crie um conceito paralelo de evento.
4. Trabalhe **fase por fase**. Ao fim de cada fase, pare, mostre o que entregou e
   aguarde meu "ok" antes de avançar.
5. **Proponha um plano antes de codar cada fase** (arquivos, migrações, endpoints,
   como se conecta à Camada 1).
6. **Pergunte antes de qualquer operação destrutiva** (drop/migração irreversível).
7. Escreva **testes** para a lógica de negócio (cálculo de tabela de classificação,
   prevenção de conflito de reserva, totais de pedido/checkout) e faça **commits
   pequenos por fase**.
8. Código em **inglês**; textos ao usuário em **português do Brasil**, preparados para
   i18n.
9. **LGPD e dados de menores** continuam valendo: exibição pública (site, escalações)
   não pode expor dados sensíveis de crianças sem consentimento do responsável.

---

## Entidades JÁ EXISTENTES no sistema (pré-requisito — NÃO recriar)

Estas já existem no Aura. Use os nomes reais abaixo, **não crie sinônimos** nem
reconstrua. O menu atual confirma:

- **Competition / League → `Competitions`** (item de menu "Competitions").
- **Fixture (partida) → `Games`** (item de menu "Games").
- **Result → não é entidade de topo:** o resultado vive **dentro de `Competitions` e na
  lista de `Games`**. Não crie uma tabela `Result` separada — leia/estenda onde já está.
- **Standing (tabela de classificação) → dentro de `Competitions`.** Já existe; não crie
  tabela separada — leia de onde já está.
- **Lineup / Selection → dentro de cada `Game`** (a escalação já existe por jogo).

Suspeita de lacuna a CONFIRMAR na Fase 0 (só construa se realmente faltar):
- **Notificação automática aos atletas convocados** quando a escalação de um `Game` é
  definida — verifique se já dispara ou se só registra a convocação.

## Modelo de dados (entidades NOVAS da Camada 2)

Tudo isolado por tenant (`organization_id`):

- **ClubSite** — configuração do microsite público do clube (tema/cores, domínio/slug,
  navegação). Um por Organization.
- **Page / Section (Block)** — páginas e blocos editáveis do site (home, sobre, notícias,
  contato). Conteúdo estruturado, não HTML solto.
- **Post / News** — notícias do clube exibidas no site e no app.
- **Invitation** — convite em massa (e-mail/SMS) com token, permitindo **resposta sem
  criar conta/instalar app**.
- **Product / ProductVariant** — itens da loja (uniformes, merchandising) com variações
  (tamanho, cor) e estoque.
- **Order / OrderItem** — pedido da loja; checkout via a **abstração de pagamento da
  Camada 1**.
- **Facility / Resource** — quadra, campo, sala disponível para reserva.
- **Booking** — reserva de uma Facility, com prevenção de conflito de horário.
- **Sponsor / SponsorshipPackage** — patrocinadores e pacotes de patrocínio vendáveis,
  exibidos no site.

---

## Escopo por fase

### Fase 0 — Reconhecimento
Inspecione o repo, confirme o estado da Camada 1 (entidades, abstração de pagamento,
slug público, RBAC, módulo de comunicação) e **localize pelos nomes reais do código as
entidades já existentes**: `Competitions`, `Games`, o resultado (dentro de Competitions
e da lista de `Games`) e a escalação (dentro de cada Game). Responda explicitamente: **a
escalação de um `Game` já notifica os convocados, ou só registra a convocação?** (a
classificação já existe dentro de `Competitions` — confirme apenas se ela recalcula
sozinha ao lançar resultados ou se hoje é preenchida manualmente). Com base nisso,
proponha como a Camada 2 se encaixa reusando o que existe e qual é o **delta** a
construir. Não codifique ainda — só mapeie e me apresente o plano.
**Pronto quando:** eu confirmo que o mapeamento e o delta batem com o projeto real.

### Fase 1 — Site público do clube (website builder)
Microsite por tenant servido pelo slug da Organization: páginas e blocos editáveis,
notícias, área de patrocinadores, navegação configurável, design responsivo. Deve
linkar para o **fluxo de matrícula online da Camada 1**.
**Pronto quando:** monto um site simples do clube pela interface e ele fica público no
slug, com link de matrícula funcionando.

### Fase 2 — Exibição pública de competições (apenas o delta)
`Competitions`, `Games`, resultados e **classificação já existem — não recrie**. Esta
fase entrega só o que falta: **exibir jogos, resultados e tabela de classificação no
site público** da Fase 1, lendo das entidades existentes. Único ajuste de lógica
possível: se (e somente se) a classificação for hoje preenchida manualmente, torná-la um
cálculo derivado dos resultados (pontos, saldo, jogos), nunca campo manual.
**Pronto quando:** jogos, resultados e classificação aparecem no site público lendo dos
dados que já existem.

### Fase 3 — Notificação de convocação (apenas o delta)
A escalação **já existe dentro de cada `Game` — não recrie a seleção**. Esta fase só
adiciona, se ainda não houver, o disparo de **notificação aos atletas convocados** (e aos
responsáveis, quando menor) ao definir/alterar a escalação, via o módulo de comunicação
da Camada 1.
**Pronto quando:** ao fechar a escalação de um `Game`, os convocados recebem notificação.

### Fase 4 — Onboarding sem fricção (convites em massa)
Convites por e-mail/SMS e **importação via planilha**; fluxo em que o convidado
**responde/confirma sem precisar criar conta ou instalar app** (via token). Inspiração:
o modelo de adoção rápida do Spond.
**Pronto quando:** importo uma lista, disparo convites e alguém confirma presença por um
link sem login.

### Fase 5 — Loja online
Produtos com variações (tamanho/cor) e estoque; carrinho; pedidos; **checkout usando a
abstração de pagamento da Camada 1** (sem criar provider novo); exibição da loja no site.
**Pronto quando:** publico um uniforme, um responsável compra e o pedido fica registrado
com pagamento processado.

### Fase 6 — Patrocínios
Cadastro de patrocinadores, pacotes de patrocínio vendáveis (checkout via pagamento da
Camada 1), exibição no site (Fase 1) e rastreamento de receita de patrocínio.
**Pronto quando:** cadastro um pacote, ele aparece no site e consigo registrar a venda.

### Fase 7 — Reserva de instalações
Facility/Resource com disponibilidade; **reservas com prevenção de conflito de horário**;
opcionalmente cobrança da reserva via pagamento da Camada 1.
**Pronto quando:** reservo uma quadra num horário e o sistema bloqueia uma reserva
conflitante.

---

## Comece agora

Execute apenas a **Fase 0**: inspecione o repositório, confirme o estado da Camada 1,
proponha como a Camada 2 se encaixa reusando o que já existe, e me apresente o plano.
Não escreva código de implementação e não avance para a Fase 1 sem minha confirmação.
