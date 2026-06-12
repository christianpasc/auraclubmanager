# Prompt — Camada 3 (desenvolvimento de atleta) do Aura Club Manager

> Cole o conteúdo abaixo no Antigravity. Pré-requisito: **Camadas 1 e 2** já
> implementadas. Esta é a camada premium (diferencial contra o 360Player) e deve ser
> construída SOBRE o que já existe, sem recriar nada.

---

## Contexto

Você é meu engenheiro de software para o **Aura Club Manager**, SaaS multi-tenant de
gestão de clubes e escolinhas de futebol. As Camadas 1 (cadastro, matrícula, financeiro,
agenda/presença, comunicação) e 2 (site, competições, loja, etc.) já existem. Agora vamos
construir a **Camada 3: desenvolvimento de atleta** — avaliação técnica, plano de
evolução individual, biblioteca de treino, análise de vídeo e estatísticas. É o que
diferencia o Aura de um "sistema de cobrança" e justifica os planos Pro/Enterprise.

**O sistema já tem itens de menu `Training` e `Scouting`.** Boa parte desta camada pode
já existir parcialmente neles. NÃO assuma que está vazio.

## Regras de trabalho (importante)

1. **Antes de escrever qualquer código**, inspecione o repositório e me responda:
   - Confirme que Camadas 1 e 2 existem e quais entidades base estão disponíveis para
     reuso: `Athlete`, `Guardian`, `Group/Team`, `Games`, `Competitions`, módulo de
     **comunicação/notificação**, abstração de **pagamento** e o **Plan** de assinatura
     do SaaS (para gate por tier).
   - **Mapeie em detalhe o que `Training` e `Scouting` já fazem hoje** (entidades,
     telas, dados). Diga o que dessa Camada 3 já está pronto nesses módulos e o que falta.
   - O `Game` da Camada 2 já guarda estatísticas/eventos da partida? Se sim, as estatísticas
     de desempenho (Fase 6) devem **ler/estender** isso, não criar paralelo.
2. **Não toque na landing page WordPress/Elementor.** Não confunda com o app.
3. **Reuse, não duplique.** `Athlete`, `Guardian`, `Game`, comunicação e pagamento já
   existem nas camadas anteriores — use-os. Se `Training`/`Scouting` já têm parte do
   escopo, estenda em vez de recriar.
4. **Gate por plano de assinatura:** estes recursos são premium. Coloque-os atrás de
   entitlements do `Plan` (Starter/Pro/Enterprise), reusando o mecanismo de assinatura
   já existente — não invente um novo.
5. Trabalhe **fase por fase**. Ao fim de cada fase, pare, mostre o resultado e aguarde
   meu "ok".
6. **Proponha um plano antes de codar cada fase** (arquivos, migrações, endpoints,
   como conecta às camadas anteriores).
7. **Pergunte antes de operações destrutivas.** Escreva **testes** para a lógica
   sensível (cálculo de evolução, agregação de estatísticas, permissões de acesso a
   vídeo) e faça **commits pequenos por fase**.
8. Código em **inglês**; textos ao usuário em **português do Brasil**, prontos para i18n.
9. **LGPD e dados de menores — atenção máxima nesta camada.** Avaliações, vídeos e
   estatísticas envolvem crianças. Exija **consentimento do responsável** para captura e
   uso de vídeo; **controle de acesso rigoroso** (quem vê o quê: treinador da turma,
   responsável do próprio filho, o próprio atleta); registre acessos a dados sensíveis;
   e nunca exponha esse material no site público da Camada 2. Scouting de menores tem
   sensibilidade extra — restrinja por papel.

---

## Modelo de dados

**Verificar primeiro (podem já existir em `Training`/`Scouting` — não recriar):**
- Sessões/planos de treino, biblioteca de exercícios, perfis/relatórios de scouting.

**Entidades novas (criar apenas o que faltar):**
- **Skill / SkillCategory** — o que é avaliado, organizado em dimensões (técnica,
  tática, física, psicológica), com escala/rubrica.
- **AssessmentTemplate** — modelo de avaliação reutilizável (conjunto de skills + escala).
- **Assessment / Evaluation** — avaliação de um `Athlete` num momento, por um treinador,
  com notas por skill e comentários.
- **PerformanceReview** — revisão periódica que consolida avaliações + observações.
- **DevelopmentPlan (PDI)** — plano de desenvolvimento individual do atleta.
- **DevelopmentGoal** — metas dentro do plano (skill-alvo, prazo, status).
- **ProgressSnapshot** — série temporal derivada das avaliações para gráficos de evolução
  (preferir cálculo derivado, não duplicar dado).
- **Drill / SessionPlan** — exercícios e planos de sessão de treino (estender `Training`
  se já houver algo).
- **DrillTag / DrillCategory** — organização e busca da biblioteca de treino.
- **Video / VideoClip / VideoTag** — vídeo do atleta/jogo, recortes e marcações, ligados
  a `Athlete`, `Assessment` e/ou `Game`. Armazenar em object storage; controle de acesso.
- **PerformanceStat** — estatística de desempenho por atleta (e por `Game`, reusando a
  Camada 2 quando possível).

---

## Escopo por fase

### Fase 0 — Reconhecimento
Inspecione o repo, confirme Camadas 1 e 2, e **mapeie em detalhe `Training` e `Scouting`
atuais**: o que já existe (entidades, telas, dados) e o que falta para a Camada 3.
Confirme onde reusar `Athlete`, `Game`, comunicação, pagamento e o `Plan` de assinatura
(para gate premium). Proponha o **delta** e o plano geral. Não codifique ainda.
**Pronto quando:** eu confirmo o mapeamento de Training/Scouting e o delta a construir.

### Fase 1 — Avaliação técnica (assessments)
Cadastro de Skills/categorias e AssessmentTemplate; tela do treinador para **avaliar um
atleta** por skill (com escala/rubrica) e comentar. Reusa `Athlete` e `Group/Team`.
**Pronto quando:** um treinador cria um modelo de avaliação e avalia um atleta da turma.

### Fase 2 — Evolução e revisões de desempenho
Gráficos de **evolução do atleta** ao longo do tempo a partir das avaliações
(ProgressSnapshot derivado) e PerformanceReview periódica. Visão para o **responsável e o
próprio atleta** acompanharem a evolução, respeitando o controle de acesso.
**Pronto quando:** após 2+ avaliações, vejo o gráfico de evolução e o responsável vê o do
próprio filho.

### Fase 3 — Plano de desenvolvimento individual (PDI)
DevelopmentPlan com metas (DevelopmentGoal) ligadas a skills e prazos, acompanhamento de
status, e **compartilhamento com atleta/responsável** via o módulo de comunicação da
Camada 1.
**Pronto quando:** monto um PDI com metas para um atleta, ele é notificado e acompanha o
progresso.

### Fase 4 — Biblioteca de conteúdo de treino
Drill/SessionPlan com tags/categorias e busca; criar, curar e **compartilhar** conteúdo;
**anexar a sessões de treino** (estendendo `Training` se já existir, não recriando).
**Pronto quando:** crio um exercício na biblioteca e o uso/anexo num treino.

### Fase 5 — Análise de vídeo
Upload de vídeo (object storage), **recorte em clipes e marcação (tags)**, vinculando a
`Athlete`, `Assessment` e/ou `Game`. MVP = upload + clipe + marcação manual + playback;
**análise automática (visão computacional) fica fora deste escopo.** Consentimento do
responsável e controle de acesso obrigatórios.
**Pronto quando:** subo um vídeo, marco um trecho e o vínculo com o atleta/jogo, com
acesso restrito a quem tem permissão.

### Fase 6 — Estatísticas de desempenho
PerformanceStat por atleta e por `Game` (reusando dados da Camada 2 quando houver);
painéis de desempenho que **alimentam a evolução** da Fase 2.
**Pronto quando:** registro estatísticas de um jogo e elas aparecem no painel do atleta.

---

## Comece agora

Execute apenas a **Fase 0**: inspecione o repositório, mapeie em detalhe o que `Training`
e `Scouting` já fazem, confirme o reuso das Camadas 1 e 2, e proponha o delta + plano
geral. Não escreva código de implementação e não avance para a Fase 1 sem minha
confirmação.
