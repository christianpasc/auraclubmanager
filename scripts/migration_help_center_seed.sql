-- ============================================
-- Migration: Help Center seed content
-- 3 categories + 27 articles, published, in 5 languages.
-- pt-BR/en-US: full original content. pt-PT/es-ES/fr-FR: adapted shorter
-- translations (admin can refine later via /admin/help).
-- Safe to re-run: categories/articles are matched by slug via ON CONFLICT.
-- ============================================

WITH cat AS (
  INSERT INTO public.help_categories (slug, name_i18n, sort_order) VALUES
    ('equipe-esporte', jsonb_build_object(
      'pt-BR', 'Equipe & Esporte', 'pt-PT', 'Equipa & Desporto', 'en-US', 'Team & Sport',
      'es-ES', 'Equipo y Deporte', 'fr-FR', 'Équipe & Sport'
    ), 0),
    ('gestao', jsonb_build_object(
      'pt-BR', 'Gestão', 'pt-PT', 'Gestão', 'en-US', 'Management',
      'es-ES', 'Gestión', 'fr-FR', 'Gestion'
    ), 1),
    ('conta-configuracoes', jsonb_build_object(
      'pt-BR', 'Conta & Configurações', 'pt-PT', 'Conta & Configurações', 'en-US', 'Account & Settings',
      'es-ES', 'Cuenta y Configuración', 'fr-FR', 'Compte & Paramètres'
    ), 2)
  ON CONFLICT (slug) DO UPDATE SET name_i18n = EXCLUDED.name_i18n
  RETURNING id, slug
)
INSERT INTO public.help_articles (category_id, slug, title_i18n, excerpt_i18n, content_i18n, feature_key, route_key, status, sort_order)
SELECT cat.id, v.slug, v.title_i18n, v.excerpt_i18n, v.content_i18n, v.feature_key, v.route_key, 'published', v.sort_order
FROM cat
JOIN (VALUES

-- ============================================
-- EQUIPE & ESPORTE
-- ============================================

('equipe-esporte', 'dashboard', NULL, 'dashboard', 1,
 jsonb_build_object('pt-BR','Dashboard','pt-PT','Dashboard','en-US','Dashboard','es-ES','Panel principal','fr-FR','Tableau de bord'),
 jsonb_build_object('pt-BR','Visão geral do clube ao entrar no sistema.','en-US','An overview of your club as soon as you log in.','pt-PT','Visão geral do clube ao entrar no sistema.','es-ES','Una visión general del club al iniciar sesión.','fr-FR','Vue d''ensemble du club dès la connexion.'),
 jsonb_build_object(
  'pt-BR', $h$<p>O Dashboard é a primeira tela que você vê ao entrar no Aura. Ele reúne em um só lugar os números mais importantes do clube: total de atletas ativos, mensalidades pendentes, próximos jogos e treinos agendados.</p><h3>O que você encontra aqui</h3><ul><li>Cartões de resumo com totais de atletas, receita do mês e pendências financeiras</li><li>Lista dos próximos jogos e treinos cadastrados</li><li>Atalhos rápidos para as áreas mais usadas do sistema</li></ul><p>Use o Dashboard como ponto de partida do seu dia: ele aponta rapidamente o que precisa de atenção, como mensalidades atrasadas ou jogos próximos sem escalação definida.</p>$h$,
  'en-US', $h$<p>The Dashboard is the first screen you see when you log into Aura. It brings together your club's most important numbers in one place: total active athletes, pending monthly fees, upcoming games and scheduled training sessions.</p><h3>What you'll find here</h3><ul><li>Summary cards with athlete totals, monthly revenue and financial pending items</li><li>A list of upcoming games and scheduled training sessions</li><li>Quick shortcuts to the most used areas of the system</li></ul><p>Use the Dashboard as your daily starting point — it quickly flags what needs attention, like overdue fees or upcoming games without a confirmed lineup.</p>$h$,
  'pt-PT', $h$<p>O Dashboard é a primeira página que vê ao entrar no Aura, reunindo os números mais importantes do clube: atletas ativos, mensalidades pendentes e os próximos jogos e treinos.</p><p>Use-o como ponto de partida do dia para identificar rapidamente o que precisa de atenção.</p>$h$,
  'es-ES', $h$<p>El Panel principal es la primera pantalla que ves al entrar en Aura. Reúne los números más importantes del club: atletas activos, cuotas pendientes y los próximos partidos y entrenamientos.</p><p>Útilo como punto de partida diario para detectar rápidamente lo que necesita atención.</p>$h$,
  'fr-FR', $h$<p>Le tableau de bord est le premier écran que vous voyez en vous connectant à Aura. Il regroupe les chiffres les plus importants du club : athlètes actifs, cotisations en attente, prochains matchs et entraînements.</p><p>Utilisez-le comme point de départ quotidien pour repérer rapidement ce qui nécessite votre attention.</p>$h$
 )),

('equipe-esporte', 'prospeccao', 'scouting', NULL, 2,
 jsonb_build_object('pt-BR','Prospecção','pt-PT','Prospeção','en-US','Scouting','es-ES','Prospección','fr-FR','Recrutement'),
 jsonb_build_object('pt-BR','Acompanhe jogadores em observação antes de matriculá-los.','en-US','Track players you are scouting before enrolling them.'),
 jsonb_build_object(
  'pt-BR', $h$<p>A área de Prospecção serve para acompanhar jogadores que ainda não são atletas matriculados no clube, mas que estão sendo observados — peneiras, indicações, observação em outros clubes.</p><h3>Como usar</h3><ol><li>Clique em "Novo Prospecto" e cadastre nome, idade, posição e observações da avaliação</li><li>Acompanhe o status do prospecto (em avaliação, aprovado, recusado) conforme o processo avança</li><li>Quando aprovado, converta o prospecto em atleta matriculado sem precisar redigitar os dados</li></ol><p>Isso evita poluir o cadastro de Atletas com gente que ainda não faz parte oficialmente do time.</p>$h$,
  'en-US', $h$<p>The Scouting area is for tracking players who aren't enrolled athletes yet, but are being evaluated — open tryouts, referrals, or players being watched at other clubs.</p><h3>How to use it</h3><ol><li>Click "New Prospect" and register name, age, position and evaluation notes</li><li>Track the prospect's status (under evaluation, approved, rejected) as the process moves forward</li><li>Once approved, convert the prospect into an enrolled athlete without re-typing any data</li></ol><p>This keeps your Athletes roster clean, free of people who aren't officially part of the team yet.</p>$h$,
  'pt-PT', $h$<p>A Prospeção permite acompanhar jogadores em avaliação antes de serem matriculados — peneiras, indicações ou observação noutros clubes.</p><p>Registe o prospeto, acompanhe o estado da avaliação e, se aprovado, converta-o diretamente em atleta.</p>$h$,
  'es-ES', $h$<p>La Prospección permite seguir a jugadores en evaluación antes de matricularlos: pruebas, referencias u observación en otros clubes.</p><p>Registra el prospecto, sigue el estado de la evaluación y, si es aprobado, convirtiéndolo directamente en atleta.</p>$h$,
  'fr-FR', $h$<p>Le Recrutement permet de suivre les joueurs en observation avant leur inscription : essais, recommandations ou suivi dans d'autres clubs.</p><p>Enregistrez le profil, suivez le statut de l'évaluation et, une fois approuvé, convertissez-le directement en athlète.</p>$h$
 )),

('equipe-esporte', 'cadastro-de-atletas', 'athletes', NULL, 3,
 jsonb_build_object('pt-BR','Atletas','pt-PT','Atletas','en-US','Athletes','es-ES','Atletas','fr-FR','Athlètes'),
 jsonb_build_object('pt-BR','Cadastro completo dos atletas do clube.','en-US','Your club''s full athlete roster.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Atletas é o cadastro central de todos os jogadores do clube. Cada ficha guarda dados pessoais, responsáveis, categoria, status (ativo/inativo) e o histórico do atleta dentro do Aura — vídeos, avaliações, jogos disputados.</p><h3>O que dá pra fazer</h3><ul><li>Cadastrar um novo atleta com dados pessoais, foto e categoria de idade</li><li>Vincular responsáveis (pais/tutores) para atletas menores de idade</li><li>Acessar, a partir da ficha do atleta, sua evolução técnica, vídeos e estatísticas de jogos</li><li>Buscar e filtrar a lista por nome, categoria ou status</li></ul><p>A ficha do atleta é o ponto de partida para quase todas as outras áreas do sistema — avaliações, vídeos e mensalidades sempre remetem a um atleta cadastrado aqui.</p>$h$,
  'en-US', $h$<p>Athletes is the central registry of every player in your club. Each profile holds personal data, guardians, age category, status (active/inactive) and the athlete's full history inside Aura — videos, assessments, games played.</p><h3>What you can do</h3><ul><li>Register a new athlete with personal data, photo and age category</li><li>Link guardians (parents/tutors) for underage athletes</li><li>From the athlete's profile, access their technical evolution, videos and game stats</li><li>Search and filter the list by name, category or status</li></ul><p>The athlete profile is the starting point for almost every other area of the system — assessments, videos and monthly fees all reference an athlete registered here.</p>$h$,
  'pt-PT', $h$<p>Atletas é o registo central de todos os jogadores do clube, com dados pessoais, responsáveis, categoria e histórico (avaliações, vídeos, jogos).</p><p>A partir da ficha de cada atleta acede-se à evolução técnica, vídeos e estatísticas.</p>$h$,
  'es-ES', $h$<p>Atletas es el registro central de todos los jugadores del club, con datos personales, responsables, categoría e historial (evaluaciones, vídeos, partidos).</p><p>Desde la ficha de cada atleta se accede a su evolución técnica, vídeos y estadísticas.</p>$h$,
  'fr-FR', $h$<p>Athlètes est le registre central de tous les joueurs du club, avec données personnelles, tuteurs, catégorie et historique (évaluations, vidéos, matchs).</p><p>Depuis la fiche de chaque athlète, on accède à son évolution technique, ses vidéos et ses statistiques.</p>$h$
 )),

('equipe-esporte', 'avaliacoes-tecnicas', 'assessments', NULL, 4,
 jsonb_build_object('pt-BR','Avaliações Técnicas','pt-PT','Avaliações Técnicas','en-US','Technical Assessments','es-ES','Evaluaciones Técnicas','fr-FR','Évaluations Techniques'),
 jsonb_build_object('pt-BR','Avalie habilidades dos atletas por dimensão.','en-US','Rate athlete skills across multiple dimensions.'),
 jsonb_build_object(
  'pt-BR', $h$<p>As Avaliações Técnicas permitem registrar, periodicamente, como cada atleta está evoluindo em diferentes dimensões (técnica, física, tática, comportamental), usando notas e comentários.</p><h3>Como usar</h3><ol><li>Crie uma avaliação selecionando o atleta e o período avaliado</li><li>Atribua notas para cada dimensão definida no modelo de avaliação usado</li><li>Adicione comentários qualitativos do treinador</li><li>Compare avaliações ao longo do tempo na tela de Evolução do Atleta</li></ol><p>Para padronizar o que é avaliado, configure antes os Modelos de Avaliação.</p>$h$,
  'en-US', $h$<p>Technical Assessments let you periodically record how each athlete is progressing across different dimensions (technical, physical, tactical, behavioral), using scores and comments.</p><h3>How to use it</h3><ol><li>Create an assessment by selecting the athlete and the period being evaluated</li><li>Score each dimension defined in the assessment template being used</li><li>Add qualitative comments from the coach</li><li>Compare assessments over time on the Athlete Evolution screen</li></ol><p>To standardize what gets evaluated, set up Assessment Templates first.</p>$h$,
  'pt-PT', $h$<p>As Avaliações Técnicas registam periodicamente a evolução de cada atleta em dimensões técnicas, físicas, táticas e comportamentais, com notas e comentários.</p><p>Configure primeiro os Modelos de Avaliação para padronizar os critérios.</p>$h$,
  'es-ES', $h$<p>Las Evaluaciones Técnicas registran periódicamente la evolución de cada atleta en dimensiones técnicas, físicas, tácticas y de comportamiento, con notas y comentarios.</p><p>Configura primero los Modelos de Evaluación para estandarizar los criterios.</p>$h$,
  'fr-FR', $h$<p>Les Évaluations Techniques enregistrent périodiquement la progression de chaque athlète selon des dimensions techniques, physiques, tactiques et comportementales, avec notes et commentaires.</p><p>Configurez d'abord les Modèles d'Évaluation pour standardiser les critères.</p>$h$
 )),

('equipe-esporte', 'modelos-de-avaliacao', NULL, 'assessment_templates', 5,
 jsonb_build_object('pt-BR','Modelos de Avaliação','pt-PT','Modelos de Avaliação','en-US','Assessment Templates','es-ES','Modelos de Evaluación','fr-FR','Modèles d''Évaluation'),
 jsonb_build_object('pt-BR','Defina os critérios usados nas avaliações técnicas.','en-US','Define the criteria used in technical assessments.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Modelos de Avaliação são os "formulários" usados pelas Avaliações Técnicas. Aqui você define quais dimensões e critérios serão avaliados — por exemplo, "Técnica: condução, passe, finalização" ou "Físico: velocidade, resistência".</p><h3>Como usar</h3><ul><li>Crie um modelo com um nome (ex: "Avaliação Sub-15")</li><li>Adicione as dimensões e critérios específicos que farão sentido para essa categoria</li><li>Use esse modelo ao criar novas avaliações técnicas para os atletas</li></ul><p>Ter modelos diferentes por categoria de idade ajuda a avaliar cada faixa com critérios apropriados.</p>$h$,
  'en-US', $h$<p>Assessment Templates are the "forms" used by Technical Assessments. Here you define which dimensions and criteria will be evaluated — for example, "Technical: dribbling, passing, finishing" or "Physical: speed, stamina".</p><h3>How to use it</h3><ul><li>Create a template with a name (e.g. "U-15 Assessment")</li><li>Add the dimensions and specific criteria that make sense for that category</li><li>Use this template when creating new technical assessments for athletes</li></ul><p>Having different templates per age category helps evaluate each group with appropriate criteria.</p>$h$,
  'pt-PT', $h$<p>Os Modelos de Avaliação definem as dimensões e critérios usados nas Avaliações Técnicas, como "Técnica" ou "Físico".</p><p>Crie modelos diferentes por categoria de idade para avaliar cada faixa com critérios apropriados.</p>$h$,
  'es-ES', $h$<p>Los Modelos de Evaluación definen las dimensiones y criterios usados en las Evaluaciones Técnicas, como "Técnica" o "Físico".</p><p>Crea modelos distintos por categoría de edad para evaluar cada franja con criterios adecuados.</p>$h$,
  'fr-FR', $h$<p>Les Modèles d'Évaluation définissent les dimensions et critères utilisés dans les Évaluations Techniques, comme « Technique » ou « Physique ».</p><p>Créez des modèles différents par catégorie d'âge pour évaluer chaque tranche avec des critères appropriés.</p>$h$
 )),

('equipe-esporte', 'evolucao-do-atleta', NULL, 'athlete_evolution', 6,
 jsonb_build_object('pt-BR','Evolução do Atleta','pt-PT','Evolução do Atleta','en-US','Athlete Evolution','es-ES','Evolución del Atleta','fr-FR','Évolution de l''Athlète'),
 jsonb_build_object('pt-BR','Veja a progressão técnica e estatísticas do atleta.','en-US','See the athlete''s technical progress and stats.'),
 jsonb_build_object(
  'pt-BR', $h$<p>A tela de Evolução do Atleta reúne, em um único lugar, todas as avaliações técnicas feitas para aquele atleta ao longo do tempo, junto com estatísticas de desempenho em jogos (gols, assistências, minutos jogados).</p><h3>O que você vê aqui</h3><ul><li>Gráfico de evolução das notas por dimensão entre avaliações</li><li>Histórico de avaliações com comentários dos treinadores</li><li>Estatísticas agregadas de jogos disputados</li></ul><p>É acessada diretamente pela ficha do atleta, e ajuda a mostrar para pais e responsáveis o progresso real do jogador no clube.</p>$h$,
  'en-US', $h$<p>The Athlete Evolution screen brings together every technical assessment made for that athlete over time, alongside game performance stats (goals, assists, minutes played).</p><h3>What you'll see here</h3><ul><li>A progress chart showing scores per dimension across assessments</li><li>Assessment history with coach comments</li><li>Aggregated stats from games played</li></ul><p>It's accessed directly from the athlete's profile, and helps show parents and guardians the player's real progress at the club.</p>$h$,
  'pt-PT', $h$<p>A Evolução do Atleta reúne todas as avaliações técnicas feitas ao longo do tempo e as estatísticas de jogos (golos, assistências, minutos).</p><p>Acede-se diretamente pela ficha do atleta.</p>$h$,
  'es-ES', $h$<p>La Evolución del Atleta reúne todas las evaluaciones técnicas realizadas a lo largo del tiempo y las estadísticas de partidos (goles, asistencias, minutos).</p><p>Se accede directamente desde la ficha del atleta.</p>$h$,
  'fr-FR', $h$<p>L'Évolution de l'Athlète regroupe toutes les évaluations techniques réalisées au fil du temps et les statistiques de matchs (buts, passes décisives, minutes jouées).</p><p>On y accède directement depuis la fiche de l'athlète.</p>$h$
 )),

('equipe-esporte', 'planos-de-desenvolvimento', 'development_plans', NULL, 7,
 jsonb_build_object('pt-BR','Planos de Desenvolvimento','pt-PT','Planos de Desenvolvimento','en-US','Development Plans','es-ES','Planes de Desarrollo','fr-FR','Plans de Développement'),
 jsonb_build_object('pt-BR','PDI com metas individuais para cada atleta.','en-US','Individual development goals for each athlete.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Os Planos de Desenvolvimento Individual (PDI) servem para definir metas específicas para um atleta — por exemplo, "melhorar o chute de longa distância até o fim da temporada" — e acompanhar o progresso dessas metas.</p><h3>Como usar</h3><ol><li>Crie um plano vinculado ao atleta, com período de início e fim</li><li>Defina as metas, cada uma com uma descrição clara e mensurável</li><li>Atualize o status de cada meta (não iniciada, em progresso, concluída) conforme o tempo passa</li></ol><p>É uma ferramenta de acompanhamento individualizado, complementar às Avaliações Técnicas (que são mais periódicas e padronizadas).</p>$h$,
  'en-US', $h$<p>Individual Development Plans (IDPs) let you set specific goals for an athlete — for example, "improve long-range shooting by the end of the season" — and track progress on those goals.</p><h3>How to use it</h3><ol><li>Create a plan linked to the athlete, with a start and end period</li><li>Define the goals, each with a clear and measurable description</li><li>Update each goal's status (not started, in progress, completed) as time passes</li></ol><p>It's an individualized tracking tool, complementing Technical Assessments (which are more periodic and standardized).</p>$h$,
  'pt-PT', $h$<p>Os Planos de Desenvolvimento Individual definem metas específicas para um atleta e acompanham o progresso ao longo do tempo.</p><p>Complementam as Avaliações Técnicas, que são mais periódicas e padronizadas.</p>$h$,
  'es-ES', $h$<p>Los Planes de Desarrollo Individual definen metas específicas para un atleta y siguen el progreso a lo largo del tiempo.</p><p>Complementan las Evaluaciones Técnicas, que son más periódicas y estandarizadas.</p>$h$,
  'fr-FR', $h$<p>Les Plans de Développement Individuel définissent des objectifs spécifiques pour un athlète et suivent leur progression dans le temps.</p><p>Ils complètent les Évaluations Techniques, plus périodiques et standardisées.</p>$h$
 )),

('equipe-esporte', 'biblioteca-de-exercicios', 'drill_library', NULL, 8,
 jsonb_build_object('pt-BR','Biblioteca de Exercícios','pt-PT','Biblioteca de Exercícios','en-US','Drill Library','es-ES','Biblioteca de Ejercicios','fr-FR','Bibliothèque d''Exercices'),
 jsonb_build_object('pt-BR','Catálogo de exercícios e planos de treino reutilizáveis.','en-US','A reusable catalog of drills and training plans.'),
 jsonb_build_object(
  'pt-BR', $h$<p>A Biblioteca de Exercícios é onde você cadastra exercícios de treino reutilizáveis, organizados por categoria (técnico, físico, tático) e faixa etária, para usar depois ao montar sessões de Treino.</p><h3>Como usar</h3><ul><li>Cadastre um exercício com nome, descrição, categoria e duração estimada</li><li>Organize por tags para facilitar a busca depois</li><li>Ao criar um novo treino, selecione exercícios já cadastrados aqui em vez de descrever tudo do zero</li></ul><p>Isso economiza tempo na hora de planejar treinos recorrentes e cria um acervo do método de trabalho do clube.</p>$h$,
  'en-US', $h$<p>The Drill Library is where you register reusable training drills, organized by category (technical, physical, tactical) and age group, to use later when building Training sessions.</p><h3>How to use it</h3><ul><li>Register a drill with name, description, category and estimated duration</li><li>Organize with tags to make it easier to search later</li><li>When creating a new training session, pick drills already registered here instead of describing everything from scratch</li></ul><p>This saves time when planning recurring training sessions and builds an archive of the club's coaching method.</p>$h$,
  'pt-PT', $h$<p>A Biblioteca de Exercícios regista exercícios de treino reutilizáveis, organizados por categoria e faixa etária, para usar ao montar sessões de Treino.</p><p>Poupa tempo no planeamento e cria um acervo do método do clube.</p>$h$,
  'es-ES', $h$<p>La Biblioteca de Ejercicios registra ejercicios de entrenamiento reutilizables, organizados por categoría y franja de edad, para usar al crear sesiones de Entrenamiento.</p><p>Ahorra tiempo en la planificación y crea un archivo del método del club.</p>$h$,
  'fr-FR', $h$<p>La Bibliothèque d'Exercices enregistre des exercices d'entraînement réutilisables, organisés par catégorie et tranche d'âge, à utiliser lors de la création de séances d'Entraînement.</p><p>Cela permet de gagner du temps et de constituer une archive de la méthode du club.</p>$h$
 )),

('equipe-esporte', 'analise-de-video', 'video_analysis', NULL, 9,
 jsonb_build_object('pt-BR','Análise de Vídeo','pt-PT','Análise de Vídeo','en-US','Video Analysis','es-ES','Análisis de Vídeo','fr-FR','Analyse Vidéo'),
 jsonb_build_object('pt-BR','Suba, recorte e marque jogadas em vídeos.','en-US','Upload, clip and annotate plays on video.'),
 jsonb_build_object(
  'pt-BR', $h$<p>A Análise de Vídeo reúne três ferramentas: a Biblioteca de Vídeos (upload e organização), o Player (reprodução com clipes) e as Anotações (desenho sobre o frame).</p><h3>Biblioteca de Vídeos</h3><p>Envie vídeos de jogos ou treinos, vincule a um ou mais jogadores, marque como privado se necessário, e o sistema gera automaticamente uma miniatura do vídeo.</p><h3>Clipes</h3><p>No player, marque um intervalo de tempo (início/fim) e dê um título — por exemplo "Gol do Marcelo, 35min" — para criar marcadores rápidos na timeline.</p><h3>Anotações</h3><p>Pause o vídeo em um instante específico e desenhe setas, círculos ou linhas livres sobre o frame para explicar uma jogada, como faz um comentarista de TV. Dá pra usar em tela cheia para mais precisão.</p><p>Atenção: para atletas menores de idade, é necessário registrar o consentimento do responsável antes de tornar o vídeo visível.</p>$h$,
  'en-US', $h$<p>Video Analysis brings together three tools: the Video Library (upload and organization), the Player (playback with clips) and Annotations (drawing on the frame).</p><h3>Video Library</h3><p>Upload game or training videos, link them to one or more players, mark them as private if needed — the system automatically generates a thumbnail for the video.</p><h3>Clips</h3><p>In the player, mark a time range (start/end) and give it a title — e.g. "Marcelo's goal, 35min" — to create quick markers on the timeline.</p><h3>Annotations</h3><p>Pause the video at a specific moment and draw arrows, circles or freehand lines on the frame to explain a play, like a TV commentator would. You can switch to fullscreen for more precision.</p><p>Note: for underage athletes, a guardian's consent must be recorded before the video becomes visible.</p>$h$,
  'pt-PT', $h$<p>A Análise de Vídeo junta a Biblioteca de Vídeos (carregamento), o Leitor (com clipes) e as Anotações (desenho sobre o fotograma).</p><p>Carregue vídeos, crie clipes marcando início/fim, e desenhe setas ou círculos para explicar jogadas. Para menores, é necessário registar o consentimento do responsável.</p>$h$,
  'es-ES', $h$<p>El Análisis de Vídeo reúne la Biblioteca de Vídeos (carga), el Reproductor (con clips) y las Anotaciones (dibujo sobre el fotograma).</p><p>Sube vídeos, crea clips marcando inicio/fin, y dibuja flechas o círculos para explicar jugadas. Para menores, es necesario registrar el consentimiento del responsable.</p>$h$,
  'fr-FR', $h$<p>L'Analyse Vidéo regroupe la Bibliothèque Vidéo (téléchargement), le Lecteur (avec extraits) et les Annotations (dessin sur l'image).</p><p>Téléchargez des vidéos, créez des extraits en marquant début/fin, et dessinez des flèches ou cercles pour expliquer une action. Pour les mineurs, le consentement du tuteur doit être enregistré.</p>$h$
 )),

('equipe-esporte', 'competicoes', 'competitions', NULL, 10,
 jsonb_build_object('pt-BR','Competições','pt-PT','Competições','en-US','Competitions','es-ES','Competiciones','fr-FR','Compétitions'),
 jsonb_build_object('pt-BR','Organize torneios e campeonatos disputados pelo clube.','en-US','Organize tournaments and leagues your club plays in.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Competições é onde você cadastra os torneios e campeonatos que o clube disputa — copas regionais, campeonatos municipais, torneios amistosos.</p><h3>Como usar</h3><ol><li>Crie uma competição com nome, formato e times participantes</li><li>Defina as equipes que jogam ("nosso clube" e os adversários)</li><li>A partir daí, os Jogos cadastrados podem ser vinculados a essa competição</li></ol><p>Agrupar jogos por competição facilita ver a campanha completa do time num campeonato específico.</p>$h$,
  'en-US', $h$<p>Competitions is where you register the tournaments and leagues your club plays in — regional cups, municipal championships, friendly tournaments.</p><h3>How to use it</h3><ol><li>Create a competition with name, format and participating teams</li><li>Define the teams playing (your club and opponents)</li><li>From there, Games can be linked to that competition</li></ol><p>Grouping games by competition makes it easy to see the team's full campaign in a specific tournament.</p>$h$,
  'pt-PT', $h$<p>Competições regista os torneios e campeonatos disputados pelo clube, agrupando os Jogos correspondentes.</p><p>Facilita ver a campanha completa numa prova específica.</p>$h$,
  'es-ES', $h$<p>Competiciones registra los torneos y campeonatos disputados por el club, agrupando los Partidos correspondientes.</p><p>Facilita ver la campaña completa en una competición específica.</p>$h$,
  'fr-FR', $h$<p>Compétitions enregistre les tournois et championnats disputés par le club, en regroupant les Matchs correspondants.</p><p>Cela permet de visualiser facilement la campagne complète dans une compétition donnée.</p>$h$
 )),

('equipe-esporte', 'jogos', 'games', NULL, 11,
 jsonb_build_object('pt-BR','Jogos','pt-PT','Jogos','en-US','Games','es-ES','Partidos','fr-FR','Matchs'),
 jsonb_build_object('pt-BR','Registre partidas, escalações e resultados.','en-US','Record matches, lineups and results.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Jogos é onde você cadastra cada partida disputada pelo clube: data, adversário, local e, depois da partida, o placar e as estatísticas individuais dos atletas.</p><h3>Como usar</h3><ol><li>Crie o jogo informando data, adversário (casa/fora) e a competição vinculada (opcional)</li><li>Monte a escalação titular e defina substituições durante a partida</li><li>Após o jogo, registre o placar final e estatísticas como gols, cartões e minutos jogados por atleta</li><li>Use a Mesa Tática do jogo para desenhar esquemas táticos</li></ol><p>Esses dados alimentam automaticamente a Evolução do Atleta de cada jogador.</p>$h$,
  'en-US', $h$<p>Games is where you register every match your club plays: date, opponent, venue, and after the match, the score and each athlete's individual stats.</p><h3>How to use it</h3><ol><li>Create the game with date, opponent (home/away) and the linked competition (optional)</li><li>Set the starting lineup and define substitutions during the match</li><li>After the game, record the final score and stats like goals, cards and minutes played per athlete</li><li>Use the game's Tactical Board to sketch out tactical setups</li></ol><p>This data automatically feeds into each player's Athlete Evolution.</p>$h$,
  'pt-PT', $h$<p>Jogos regista cada partida disputada: data, adversário, local, escalação e, depois, o resultado e estatísticas individuais.</p><p>Estes dados alimentam automaticamente a Evolução de cada atleta.</p>$h$,
  'es-ES', $h$<p>Partidos registra cada encuentro disputado: fecha, rival, lugar, alineación y, después, el resultado y estadísticas individuales.</p><p>Estos datos alimentan automáticamente la Evolución de cada atleta.</p>$h$,
  'fr-FR', $h$<p>Matchs enregistre chaque rencontre disputée : date, adversaire, lieu, composition et, ensuite, le résultat et les statistiques individuelles.</p><p>Ces données alimentent automatiquement l'Évolution de chaque joueur.</p>$h$
 )),

('equipe-esporte', 'treinos', 'training', NULL, 12,
 jsonb_build_object('pt-BR','Treinos','pt-PT','Treinos','en-US','Training','es-ES','Entrenamientos','fr-FR','Entraînements'),
 jsonb_build_object('pt-BR','Planeje e registre sessões de treino.','en-US','Plan and log training sessions.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Treinos permite planejar sessões de treino com data, objetivo e exercícios, e depois registrar a presença dos atletas.</p><h3>Como usar</h3><ol><li>Crie uma sessão de treino informando data, categoria e objetivo principal</li><li>Adicione exercícios da Biblioteca de Exercícios para compor o plano da sessão</li><li>No dia do treino, marque a presença de cada atleta convocado</li></ol><p>O histórico de presença ajuda a identificar atletas com frequência baixa que precisam de atenção.</p>$h$,
  'en-US', $h$<p>Training lets you plan training sessions with date, objective and drills, then log athlete attendance.</p><h3>How to use it</h3><ol><li>Create a training session with date, category and main objective</li><li>Add drills from the Drill Library to build the session's plan</li><li>On training day, mark attendance for each called-up athlete</li></ol><p>The attendance history helps identify athletes with low attendance who need attention.</p>$h$,
  'pt-PT', $h$<p>Treinos permite planear sessões com data, objetivo e exercícios, e registar a presença dos atletas.</p><p>O histórico de presença ajuda a identificar atletas com frequência baixa.</p>$h$,
  'es-ES', $h$<p>Entrenamientos permite planificar sesiones con fecha, objetivo y ejercicios, y registrar la asistencia de los atletas.</p><p>El historial de asistencia ayuda a identificar atletas con baja frecuencia.</p>$h$,
  'fr-FR', $h$<p>Entraînements permet de planifier des séances avec date, objectif et exercices, et d'enregistrer la présence des athlètes.</p><p>L'historique de présence aide à repérer les athlètes peu assidus.</p>$h$
 )),

-- ============================================
-- GESTÃO
-- ============================================

('gestao', 'matriculas', 'enrollments', NULL, 1,
 jsonb_build_object('pt-BR','Matrículas','pt-PT','Matrículas','en-US','Enrollments','es-ES','Matrículas','fr-FR','Inscriptions'),
 jsonb_build_object('pt-BR','Gerencie a matrícula de atletas e alunos.','en-US','Manage athlete and student enrollment.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Matrículas é onde você formaliza a entrada de um atleta no clube, vinculando-o a um plano de mensalidade e gerando as parcelas a cobrar.</p><h3>Como usar</h3><ol><li>Crie uma matrícula selecionando o atleta (ou cadastre um novo direto daqui)</li><li>Escolha o plano de mensalidade aplicável</li><li>Defina a data de início e o sistema gera automaticamente as parcelas em Mensalidades</li></ol><p>Cancelar ou suspender uma matrícula interrompe a geração de novas parcelas para aquele atleta.</p>$h$,
  'en-US', $h$<p>Enrollments is where you formalize an athlete joining the club, linking them to a monthly fee plan and generating the installments to be charged.</p><h3>How to use it</h3><ol><li>Create an enrollment by selecting the athlete (or register a new one right here)</li><li>Choose the applicable fee plan</li><li>Set the start date and the system automatically generates the installments under Monthly Fees</li></ol><p>Cancelling or suspending an enrollment stops new installments from being generated for that athlete.</p>$h$,
  'pt-PT', $h$<p>Matrículas formaliza a entrada de um atleta no clube, ligando-o a um plano de mensalidade e gerando as parcelas a cobrar.</p><p>Cancelar uma matrícula interrompe a geração de novas parcelas.</p>$h$,
  'es-ES', $h$<p>Matrículas formaliza la entrada de un atleta en el club, vinculándolo a un plan de cuota y generando las cuotas a cobrar.</p><p>Cancelar una matrícula detiene la generación de nuevas cuotas.</p>$h$,
  'fr-FR', $h$<p>Inscriptions formalise l'arrivée d'un athlète au club, en le liant à un plan de cotisation et en générant les échéances à facturer.</p><p>Annuler une inscription arrête la génération de nouvelles échéances.</p>$h$
 )),

('gestao', 'financeiro', 'finance', NULL, 2,
 jsonb_build_object('pt-BR','Financeiro','pt-PT','Financeiro','en-US','Finance','es-ES','Finanzas','fr-FR','Finances'),
 jsonb_build_object('pt-BR','Visão geral das finanças do clube.','en-US','An overview of your club''s finances.'),
 jsonb_build_object(
  'pt-BR', $h$<p>O módulo Financeiro reúne, em abas, a visão completa do dinheiro do clube: Resumo, Lançamentos manuais, Mensalidades, vendas da Loja e receita de Instalações.</p><h3>Abas disponíveis</h3><ul><li><strong>Resumo:</strong> saldo, receita total, despesas e valores a receber, com gráfico por origem</li><li><strong>Lançamentos:</strong> receitas e despesas manuais (aluguel, salários, patrocínio recebido em espécie etc.)</li><li><strong>Mensalidades:</strong> cobranças manuais e via Stripe, separadas em abas</li><li><strong>Loja</strong> e <strong>Instalações:</strong> receita gerada por vendas e reservas</li></ul><p>Todas as abas têm filtros por data, mês, ano e busca por nome — por padrão, mostrando o mês vigente.</p>$h$,
  'en-US', $h$<p>The Finance module brings together your club's full financial picture in tabs: Overview, manual Entries, Monthly Fees, Store sales and Facilities revenue.</p><h3>Available tabs</h3><ul><li><strong>Overview:</strong> balance, total revenue, expenses and amounts receivable, with a chart by source</li><li><strong>Entries:</strong> manual income and expenses (rent, salaries, in-kind sponsorship, etc.)</li><li><strong>Monthly Fees:</strong> manual and Stripe charges, split into separate tabs</li><li><strong>Store</strong> and <strong>Facilities:</strong> revenue generated from sales and bookings</li></ul><p>Every tab has filters by date, month, year and name search — defaulting to the current month.</p>$h$,
  'pt-PT', $h$<p>O Financeiro reúne, em separadores, o panorama financeiro completo: Resumo, Lançamentos manuais, Mensalidades, Loja e Instalações.</p><p>Todos os separadores têm filtros por data, mês, ano e pesquisa por nome.</p>$h$,
  'es-ES', $h$<p>Finanzas reúne, en pestañas, el panorama financiero completo: Resumen, Movimientos manuales, Cuotas, Tienda e Instalaciones.</p><p>Todas las pestañas tienen filtros por fecha, mes, año y búsqueda por nombre.</p>$h$,
  'fr-FR', $h$<p>Finances regroupe, par onglets, la vue financière complète : Résumé, Saisies manuelles, Cotisations, Boutique et Installations.</p><p>Chaque onglet dispose de filtres par date, mois, année et recherche par nom.</p>$h$
 )),

('gestao', 'mensalidades', NULL, 'monthly_fees', 3,
 jsonb_build_object('pt-BR','Mensalidades','pt-PT','Mensalidades','en-US','Monthly Fees','es-ES','Cuotas Mensuales','fr-FR','Cotisations Mensuelles'),
 jsonb_build_object('pt-BR','Gerencie cobranças e parcelas dos atletas.','en-US','Manage athlete charges and installments.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Mensalidades é a tela de gerenciamento completo das parcelas geradas pelas Matrículas — cobranças manuais (registradas à mão) e cobranças via Stripe (cartão de crédito automático).</p><h3>O que você pode fazer</h3><ul><li>Ver todas as parcelas com status: pendente, pago, atrasado</li><li>Marcar manualmente uma parcela como paga (pagamento em dinheiro/PIX, por exemplo)</li><li>Para parcelas via Stripe: cobrar o cartão, reenviar o link de pagamento por e-mail, reembolsar ou cancelar a assinatura</li><li>Emitir novas parcelas avulsas quando necessário</li></ul><p>Vincule o Stripe Connect em Configurações para habilitar cobrança automática via cartão.</p>$h$,
  'en-US', $h$<p>Monthly Fees is the full management screen for installments generated by Enrollments — manual charges (recorded by hand) and Stripe charges (automatic credit card billing).</p><h3>What you can do</h3><ul><li>See every installment with its status: pending, paid, overdue</li><li>Manually mark an installment as paid (cash/bank transfer payment, for example)</li><li>For Stripe installments: charge the card, resend the payment link by email, refund or cancel the subscription</li><li>Issue new one-off installments when needed</li></ul><p>Connect Stripe Connect under Settings to enable automatic card billing.</p>$h$,
  'pt-PT', $h$<p>Mensalidades gere as parcelas geradas pelas Matrículas — cobranças manuais e via Stripe.</p><p>Pode marcar parcelas como pagas, cobrar via cartão, reenviar links de pagamento ou reembolsar.</p>$h$,
  'es-ES', $h$<p>Cuotas Mensuales gestiona las cuotas generadas por las Matrículas: cobros manuales y mediante Stripe.</p><p>Puedes marcar cuotas como pagadas, cobrar con tarjeta, reenviar enlaces de pago o reembolsar.</p>$h$,
  'fr-FR', $h$<p>Cotisations Mensuelles gère les échéances générées par les Inscriptions : paiements manuels et via Stripe.</p><p>Vous pouvez marquer une échéance comme payée, débiter la carte, renvoyer le lien de paiement ou remboursement.</p>$h$
 )),

('gestao', 'planos-de-escola', NULL, 'school_plans', 4,
 jsonb_build_object('pt-BR','Planos de Escola','pt-PT','Planos de Escola','en-US','School Plans','es-ES','Planes de Escuela','fr-FR','Plans d''École'),
 jsonb_build_object('pt-BR','Defina os planos de mensalidade oferecidos pelo clube.','en-US','Define the fee plans your club offers.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Planos de Escola é onde você cria os diferentes planos de mensalidade que o clube oferece — por exemplo, "Mensal", "Trimestral com desconto" ou "Plano Família".</p><h3>Como usar</h3><ol><li>Crie um plano com nome, valor e periodicidade (mensal, trimestral, etc.)</li><li>Vincule o plano a um produto/preço do Stripe, se for usar cobrança automática</li><li>Use esse plano ao matricular atletas em Matrículas</li></ol><p>Ter planos bem definidos antes de matricular agiliza o processo e evita inconsistência de valores cobrados.</p>$h$,
  'en-US', $h$<p>School Plans is where you create the different fee plans your club offers — for example, "Monthly", "Quarterly with discount" or "Family Plan".</p><h3>How to use it</h3><ol><li>Create a plan with name, price and billing frequency (monthly, quarterly, etc.)</li><li>Link the plan to a Stripe product/price if you'll use automatic billing</li><li>Use this plan when enrolling athletes under Enrollments</li></ol><p>Having well-defined plans before enrolling speeds up the process and avoids inconsistent charge amounts.</p>$h$,
  'pt-PT', $h$<p>Planos de Escola cria os diferentes planos de mensalidade oferecidos pelo clube, usados depois nas Matrículas.</p><p>Defina nome, valor e periodicidade antes de matricular atletas.</p>$h$,
  'es-ES', $h$<p>Planes de Escuela crea los distintos planes de cuota ofrecidos por el club, usados después en las Matrículas.</p><p>Define nombre, importe y periodicidad antes de matricular atletas.</p>$h$,
  'fr-FR', $h$<p>Plans d'École crée les différents plans de cotisation proposés par le club, utilisés ensuite dans les Inscriptions.</p><p>Définissez nom, montant et périodicité avant d'inscrire des athlètes.</p>$h$
 )),

('gestao', 'turmas-e-grupos', NULL, 'groups', 5,
 jsonb_build_object('pt-BR','Turmas e Grupos','pt-PT','Turmas e Grupos','en-US','Groups & Teams','es-ES','Grupos y Equipos','fr-FR','Groupes & Équipes'),
 jsonb_build_object('pt-BR','Organize atletas em turmas e equipes.','en-US','Organize athletes into groups and teams.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Turmas (ou Grupos) permitem organizar atletas em conjuntos menores — por horário de treino, equipe titular/reserva, ou turma de uma categoria específica.</p><h3>Como usar</h3><ol><li>Crie um grupo com nome e descrição</li><li>Adicione os atletas que pertencem a esse grupo</li><li>Use grupos para facilitar a convocação em Treinos e a organização geral da categoria</li></ol><p>Um atleta pode pertencer a mais de um grupo ao mesmo tempo.</p>$h$,
  'en-US', $h$<p>Groups (or Teams) let you organize athletes into smaller sets — by training schedule, starting/reserve squad, or a specific category's class.</p><h3>How to use it</h3><ol><li>Create a group with a name and description</li><li>Add the athletes who belong to that group</li><li>Use groups to make it easier to call up athletes for Training and organize the category overall</li></ol><p>An athlete can belong to more than one group at the same time.</p>$h$,
  'pt-PT', $h$<p>Turmas e Grupos permitem organizar atletas em conjuntos menores, por horário ou equipa.</p><p>Um atleta pode pertencer a mais do que um grupo em simultâneo.</p>$h$,
  'es-ES', $h$<p>Grupos y Equipos permite organizar atletas en conjuntos más pequeños, por horario o equipo.</p><p>Un atleta puede pertenecer a más de un grupo al mismo tiempo.</p>$h$,
  'fr-FR', $h$<p>Groupes & Équipes permet d'organiser les athlètes en ensembles plus restreints, par horaire ou équipe.</p><p>Un athlète peut appartenir à plusieurs groupes en même temps.</p>$h$
 )),

('gestao', 'responsaveis', NULL, 'guardians', 6,
 jsonb_build_object('pt-BR','Responsáveis','pt-PT','Responsáveis','en-US','Guardians','es-ES','Responsables','fr-FR','Tuteurs'),
 jsonb_build_object('pt-BR','Cadastro de pais e responsáveis pelos atletas.','en-US','Registry of athletes'' parents and guardians.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Responsáveis cadastra os pais ou tutores legais de atletas menores de idade, com dados de contato e a relação com cada atleta vinculado.</p><h3>Como usar</h3><ol><li>Cadastre o responsável com nome, contato e documento</li><li>Vincule-o a um ou mais atletas, definindo o tipo de relação (pai, mãe, tutor)</li><li>Comunicações como cobranças e consentimentos de vídeo são direcionadas ao responsável vinculado</li></ol><p>Um mesmo responsável pode estar vinculado a vários irmãos matriculados no clube.</p>$h$,
  'en-US', $h$<p>Guardians registers the parents or legal guardians of underage athletes, with contact info and the relationship to each linked athlete.</p><h3>How to use it</h3><ol><li>Register the guardian with name, contact info and document</li><li>Link them to one or more athletes, defining the relationship type (father, mother, tutor)</li><li>Communications like billing and video consent are directed to the linked guardian</li></ol><p>The same guardian can be linked to multiple siblings enrolled at the club.</p>$h$,
  'pt-PT', $h$<p>Responsáveis regista os pais ou tutores legais de atletas menores, com contacto e a relação com cada atleta.</p><p>As comunicações de cobrança e consentimento são direcionadas ao responsável.</p>$h$,
  'es-ES', $h$<p>Responsables registra a los padres o tutores legales de atletas menores, con contacto y la relación con cada atleta.</p><p>Las comunicaciones de cobro y consentimiento se dirigen al responsable.</p>$h$,
  'fr-FR', $h$<p>Tuteurs enregistre les parents ou tuteurs légaux des athlètes mineurs, avec contact et lien avec chaque athlète.</p><p>Les communications de facturation et de consentement sont adressées au tuteur.</p>$h$
 )),

('gestao', 'temporadas', NULL, 'seasons', 7,
 jsonb_build_object('pt-BR','Temporadas','pt-PT','Temporadas','en-US','Seasons','es-ES','Temporadas','fr-FR','Saisons'),
 jsonb_build_object('pt-BR','Organize o clube por temporadas/anos esportivos.','en-US','Organize the club by sporting seasons/years.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Temporadas permite delimitar períodos esportivos (ex: "Temporada 2026") para organizar competições, jogos e estatísticas dentro de um intervalo de tempo específico.</p><h3>Como usar</h3><ol><li>Crie uma temporada com nome e datas de início/fim</li><li>Marque a temporada vigente como ativa</li><li>Use o filtro de temporada em outras telas para ver dados de um período específico</li></ol><p>Isso facilita comparar o desempenho do clube ano a ano.</p>$h$,
  'en-US', $h$<p>Seasons lets you define sporting periods (e.g. "2026 Season") to organize competitions, games and stats within a specific time range.</p><h3>How to use it</h3><ol><li>Create a season with name and start/end dates</li><li>Mark the current season as active</li><li>Use the season filter on other screens to view data from a specific period</li></ol><p>This makes it easier to compare the club's performance year over year.</p>$h$,
  'pt-PT', $h$<p>Temporadas permite delimitar períodos desportivos para organizar competições, jogos e estatísticas.</p><p>Facilita comparar o desempenho do clube ano a ano.</p>$h$,
  'es-ES', $h$<p>Temporadas permite delimitar periodos deportivos para organizar competiciones, partidos y estadísticas.</p><p>Facilita comparar el rendimiento del club año a año.</p>$h$,
  'fr-FR', $h$<p>Saisons permet de délimiter des périodes sportives pour organiser compétitions, matchs et statistiques.</p><p>Cela facilite la comparaison des performances du club d'année en année.</p>$h$
 )),

('gestao', 'categorias-de-idade', NULL, 'age_categories', 8,
 jsonb_build_object('pt-BR','Categorias de Idade','pt-PT','Categorias de Idade','en-US','Age Categories','es-ES','Categorías de Edad','fr-FR','Catégories d''Âge'),
 jsonb_build_object('pt-BR','Defina as categorias etárias do clube.','en-US','Define the club''s age categories.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Categorias de Idade define as faixas etárias usadas para classificar atletas — por exemplo, Sub-9, Sub-11, Sub-15.</p><h3>Como usar</h3><ol><li>Crie uma categoria com nome e intervalo de idade (ano de nascimento)</li><li>Atribua a categoria a cada atleta no cadastro</li><li>Use categorias para filtrar listagens e organizar Turmas, Treinos e Modelos de Avaliação</li></ol><p>Manter as categorias atualizadas a cada temporada evita confusão na hora de formar equipes.</p>$h$,
  'en-US', $h$<p>Age Categories defines the age ranges used to classify athletes — for example, U-9, U-11, U-15.</p><h3>How to use it</h3><ol><li>Create a category with a name and age range (birth year)</li><li>Assign the category to each athlete's profile</li><li>Use categories to filter listings and organize Groups, Training and Assessment Templates</li></ol><p>Keeping categories up to date each season avoids confusion when forming teams.</p>$h$,
  'pt-PT', $h$<p>Categorias de Idade define as faixas etárias usadas para classificar atletas, como Sub-9 ou Sub-15.</p><p>Mantenha-as atualizadas a cada temporada.</p>$h$,
  'es-ES', $h$<p>Categorías de Edad define las franjas de edad usadas para clasificar atletas, como Sub-9 o Sub-15.</p><p>Manténlas actualizadas cada temporada.</p>$h$,
  'fr-FR', $h$<p>Catégories d'Âge définit les tranches d'âge utilisées pour classer les athlètes, comme U-9 ou U-15.</p><p>Maintenez-les à jour à chaque saison.</p>$h$
 )),

('gestao', 'site-do-clube', NULL, 'club_site', 9,
 jsonb_build_object('pt-BR','Site do Clube','pt-PT','Site do Clube','en-US','Club Site','es-ES','Sitio del Club','fr-FR','Site du Club'),
 jsonb_build_object('pt-BR','Crie uma página pública para o seu clube.','en-US','Build a public page for your club.'),
 jsonb_build_object(
  'pt-BR', $h$<p>O Editor do Site do Clube permite montar uma página pública (acessível sem login, em um endereço próprio) com notícias, competições, jogos e patrocinadores do clube.</p><h3>Como usar</h3><ol><li>Defina um identificador único (slug) para a URL pública do site</li><li>Publique posts/notícias para manter a página atualizada</li><li>O site exibe automaticamente competições, jogos recentes e patrocinadores cadastrados em outras áreas</li></ol><p>É uma vitrine pública do clube, útil para divulgação e captação de novos atletas.</p>$h$,
  'en-US', $h$<p>The Club Site Editor lets you build a public page (accessible without login, on your own address) showing news, competitions, games and sponsors.</p><h3>How to use it</h3><ol><li>Set a unique identifier (slug) for the site's public URL</li><li>Publish posts/news to keep the page up to date</li><li>The site automatically displays competitions, recent games and sponsors registered elsewhere in the system</li></ol><p>It's a public showcase for the club, useful for outreach and attracting new athletes.</p>$h$,
  'pt-PT', $h$<p>O Editor do Site do Clube cria uma página pública com notícias, competições, jogos e patrocinadores.</p><p>É uma vitrine pública útil para divulgação e captação de novos atletas.</p>$h$,
  'es-ES', $h$<p>El Editor del Sitio del Club crea una página pública con noticias, competiciones, partidos y patrocinadores.</p><p>Es un escaparate público útil para la divulgación y captación de nuevos atletas.</p>$h$,
  'fr-FR', $h$<p>L'Éditeur du Site du Club crée une page publique avec actualités, compétitions, matchs et sponsors.</p><p>C'est une vitrine publique utile pour la communication et le recrutement de nouveaux athlètes.</p>$h$
 )),

('gestao', 'convites', NULL, 'invitations', 10,
 jsonb_build_object('pt-BR','Convites','pt-PT','Convites','en-US','Invitations','es-ES','Invitaciones','fr-FR','Invitations'),
 jsonb_build_object('pt-BR','Convide pessoas para eventos do clube.','en-US','Invite people to club events.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Convites permite enviar e gerenciar convites para eventos do clube — amistosos, festas, peneiras — e acompanhar quem confirmou presença.</p><h3>Como usar</h3><ol><li>Crie um convite com evento, data e lista de convidados</li><li>Envie o link de convite, que pode ser respondido sem necessidade de login</li><li>Acompanhe as respostas (confirmado, recusado, pendente) na lista de convites</li></ol><p>Útil para eventos que envolvem pessoas de fora do cadastro regular do clube.</p>$h$,
  'en-US', $h$<p>Invitations lets you send and manage invites for club events — friendlies, parties, tryouts — and track who confirmed attendance.</p><h3>How to use it</h3><ol><li>Create an invitation with the event, date and guest list</li><li>Send the invite link, which can be answered without needing to log in</li><li>Track responses (confirmed, declined, pending) on the invitations list</li></ol><p>Useful for events involving people outside the club's regular roster.</p>$h$,
  'pt-PT', $h$<p>Convites permite enviar e gerir convites para eventos do clube, acompanhando quem confirmou presença.</p><p>Útil para eventos com pessoas fora do registo regular do clube.</p>$h$,
  'es-ES', $h$<p>Invitaciones permite enviar y gestionar invitaciones para eventos del club, siguiendo quién confirmó asistencia.</p><p>Útil para eventos con personas fuera del registro habitual del club.</p>$h$,
  'fr-FR', $h$<p>Invitations permet d'envoyer et de gérer des invitations pour les événements du club, en suivant les confirmations de présence.</p><p>Utile pour les événements impliquant des personnes hors du registre habituel du club.</p>$h$
 )),

('gestao', 'loja-virtual', NULL, 'store', 11,
 jsonb_build_object('pt-BR','Loja Virtual','pt-PT','Loja Virtual','en-US','Online Store','es-ES','Tienda Virtual','fr-FR','Boutique en Ligne'),
 jsonb_build_object('pt-BR','Venda produtos do clube online.','en-US','Sell club merchandise online.'),
 jsonb_build_object(
  'pt-BR', $h$<p>A Loja Virtual permite cadastrar produtos do clube (uniformes, acessórios) para venda em uma vitrine pública, com pagamento processado via Stripe.</p><h3>Como usar</h3><ol><li>Cadastre um produto com nome, descrição, preço e fotos</li><li>A loja pública fica disponível em um endereço próprio, sem necessidade de login para o comprador</li><li>Acompanhe os pedidos recebidos e seus status (pendente, confirmado, enviado, entregue) na aba Loja do Financeiro</li></ol><p>A receita das vendas entregues entra automaticamente no resumo financeiro do clube.</p>$h$,
  'en-US', $h$<p>The Online Store lets you register club products (uniforms, accessories) for sale on a public storefront, with payment processed via Stripe.</p><h3>How to use it</h3><ol><li>Register a product with name, description, price and photos</li><li>The public store is available at its own address, with no login required for the buyer</li><li>Track received orders and their status (pending, confirmed, shipped, delivered) under the Store tab in Finance</li></ol><p>Revenue from delivered sales automatically feeds into the club's financial overview.</p>$h$,
  'pt-PT', $h$<p>A Loja Virtual permite vender produtos do clube numa vitrine pública, com pagamento via Stripe.</p><p>A receita das vendas entregues entra automaticamente no resumo financeiro.</p>$h$,
  'es-ES', $h$<p>La Tienda Virtual permite vender productos del club en un escaparate público, con pago vía Stripe.</p><p>Los ingresos de las ventas entregadas entran automáticamente en el resumen financiero.</p>$h$,
  'fr-FR', $h$<p>La Boutique en Ligne permet de vendre des produits du club sur une vitrine publique, avec paiement via Stripe.</p><p>Les revenus des ventes livrées alimentent automatiquement le résumé financier.</p>$h$
 )),

('gestao', 'patrocinadores', NULL, 'sponsors', 12,
 jsonb_build_object('pt-BR','Patrocinadores','pt-PT','Patrocinadores','en-US','Sponsors','es-ES','Patrocinadores','fr-FR','Sponsors'),
 jsonb_build_object('pt-BR','Gerencie os patrocinadores e parceiros do clube.','en-US','Manage your club''s sponsors and partners.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Patrocinadores cadastra empresas e parceiros que apoiam o clube, exibindo seus logotipos no Site do Clube.</p><h3>Como usar</h3><ol><li>Cadastre o patrocinador com nome, logotipo e link do site (opcional)</li><li>Defina o nível de patrocínio, se aplicável (ouro, prata, bronze)</li><li>O logotipo aparece automaticamente na página pública do clube</li></ol><p>Boa forma de dar visibilidade e prestar contas aos apoiadores do clube.</p>$h$,
  'en-US', $h$<p>Sponsors registers companies and partners who support the club, displaying their logos on the Club Site.</p><h3>How to use it</h3><ol><li>Register the sponsor with name, logo and website link (optional)</li><li>Set the sponsorship tier, if applicable (gold, silver, bronze)</li><li>The logo automatically appears on the club's public page</li></ol><p>A good way to give visibility and accountability to the club's supporters.</p>$h$,
  'pt-PT', $h$<p>Patrocinadores regista empresas e parceiros que apoiam o clube, exibindo os logótipos no Site do Clube.</p><p>Boa forma de dar visibilidade aos apoiantes.</p>$h$,
  'es-ES', $h$<p>Patrocinadores registra empresas y socios que apoyan al club, mostrando sus logotipos en el Sitio del Club.</p><p>Buena forma de dar visibilidad a los patrocinadores.</p>$h$,
  'fr-FR', $h$<p>Sponsors enregistre les entreprises et partenaires qui soutiennent le club, affichant leurs logos sur le Site du Club.</p><p>Une bonne façon de donner de la visibilité aux soutiens du club.</p>$h$
 )),

('gestao', 'instalacoes', 'facilities', NULL, 13,
 jsonb_build_object('pt-BR','Instalações','pt-PT','Instalações','en-US','Facilities','es-ES','Instalaciones','fr-FR','Installations'),
 jsonb_build_object('pt-BR','Gerencie reservas de quadras, campos e salas.','en-US','Manage bookings for courts, fields and rooms.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Instalações permite cadastrar os espaços físicos do clube (campos, quadras, salas) e gerenciar reservas feitas por terceiros ou pelo próprio clube.</p><h3>Como usar</h3><ol><li>Cadastre a instalação com nome, capacidade e valor de aluguel (se aplicável)</li><li>Registre uma reserva com data, horário, responsável e custo</li><li>Acompanhe o status da reserva (pendente, confirmada, cancelada)</li></ol><p>Reservas com custo geram receita automaticamente refletida na aba Instalações do Financeiro.</p>$h$,
  'en-US', $h$<p>Facilities lets you register your club's physical spaces (fields, courts, rooms) and manage bookings made by third parties or the club itself.</p><h3>How to use it</h3><ol><li>Register the facility with name, capacity and rental price (if applicable)</li><li>Log a booking with date, time, organizer and cost</li><li>Track the booking's status (pending, confirmed, cancelled)</li></ol><p>Bookings with a cost automatically generate revenue reflected in the Facilities tab of Finance.</p>$h$,
  'pt-PT', $h$<p>Instalações regista os espaços físicos do clube e gere reservas feitas por terceiros ou pelo clube.</p><p>Reservas com custo geram receita refletida no Financeiro.</p>$h$,
  'es-ES', $h$<p>Instalaciones registra los espacios físicos del club y gestiona reservas hechas por terceros o por el propio club.</p><p>Las reservas con coste generan ingresos reflejados en Finanzas.</p>$h$,
  'fr-FR', $h$<p>Installations enregistre les espaces physiques du club et gère les réservations faites par des tiers ou par le club.</p><p>Les réservations payantes génèrent des revenus reflétés dans Finances.</p>$h$
 )),

-- ============================================
-- CONTA & CONFIGURAÇÕES
-- ============================================

('conta-configuracoes', 'configuracoes', NULL, 'settings', 1,
 jsonb_build_object('pt-BR','Configurações','pt-PT','Configurações','en-US','Settings','es-ES','Configuración','fr-FR','Paramètres'),
 jsonb_build_object('pt-BR','Ajuste dados do clube, perfil e preferências.','en-US','Adjust club data, profile and preferences.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Configurações reúne, em abas, todos os ajustes administrativos do clube: dados gerais, preferências, perfil pessoal, notificações, segurança, usuários da equipe e configuração de pagamentos.</p><h3>Abas disponíveis</h3><ul><li><strong>Clube:</strong> nome fantasia, logotipo, país, endereço e idioma usado para comunicação com membros</li><li><strong>Preferências:</strong> moeda, formato de data e outras opções gerais</li><li><strong>Meu Perfil:</strong> seus dados pessoais e foto</li><li><strong>Notificações:</strong> quais alertas você recebe</li><li><strong>Segurança:</strong> troca de senha e opções de proteção da conta</li><li><strong>Usuários:</strong> quem tem acesso ao sistema e com qual papel (proprietário, administrador, gerente, membro)</li><li><strong>Pagamentos:</strong> conexão do clube com o Stripe para receber cobranças automáticas</li></ul>$h$,
  'en-US', $h$<p>Settings brings together every administrative adjustment for your club in tabs: general info, preferences, personal profile, notifications, security, team users and payment configuration.</p><h3>Available tabs</h3><ul><li><strong>Club:</strong> display name, logo, country, address and the language used to communicate with members</li><li><strong>Preferences:</strong> currency, date format and other general options</li><li><strong>My Profile:</strong> your personal data and photo</li><li><strong>Notifications:</strong> which alerts you receive</li><li><strong>Security:</strong> password change and account protection options</li><li><strong>Users:</strong> who has access to the system and with which role (owner, admin, manager, member)</li><li><strong>Payments:</strong> connecting the club to Stripe to receive automatic charges</li></ul>$h$,
  'pt-PT', $h$<p>Configurações reúne, em separadores, os ajustes administrativos do clube: dados gerais, preferências, perfil, notificações, segurança, utilizadores e pagamentos.</p><p>Cada separador trata de uma área específica da conta.</p>$h$,
  'es-ES', $h$<p>Configuración reúne, en pestañas, los ajustes administrativos del club: datos generales, preferencias, perfil, notificaciones, seguridad, usuarios y pagos.</p><p>Cada pestaña aborda un área específica de la cuenta.</p>$h$,
  'fr-FR', $h$<p>Paramètres regroupe, par onglets, les réglages administratifs du club : informations générales, préférences, profil, notifications, sécurité, utilisateurs et paiements.</p><p>Chaque onglet couvre un domaine spécifique du compte.</p>$h$
 )),

('conta-configuracoes', 'assinatura-e-planos', NULL, 'subscription', 2,
 jsonb_build_object('pt-BR','Assinatura & Planos','pt-PT','Assinatura & Planos','en-US','Subscription & Plans','es-ES','Suscripción y Planes','fr-FR','Abonnement & Plans'),
 jsonb_build_object('pt-BR','Gerencie a assinatura do Aura para o seu clube.','en-US','Manage your club''s Aura subscription.'),
 jsonb_build_object(
  'pt-BR', $h$<p>Assinatura mostra o plano atual do seu clube no Aura, status do período de teste, próxima cobrança e permite trocar de plano.</p><h3>O que você encontra aqui</h3><ul><li>Status da assinatura (em teste, ativa, atrasada, expirada) e dias restantes de teste, se aplicável</li><li>Detalhes do plano atual e os módulos liberados por ele</li><li>Tela de Planos, com as opções disponíveis para upgrade ou downgrade</li></ul><p>Se o período de teste expirar sem assinatura ativa, o acesso ao sistema fica limitado até a regularização do pagamento.</p>$h$,
  'en-US', $h$<p>Subscription shows your club's current Aura plan, trial status, next billing date, and lets you change plans.</p><h3>What you'll find here</h3><ul><li>Subscription status (trial, active, past due, expired) and remaining trial days, if applicable</li><li>Details of the current plan and the modules it unlocks</li><li>The Plans screen, with available options to upgrade or downgrade</li></ul><p>If the trial period expires without an active subscription, system access becomes limited until payment is settled.</p>$h$,
  'pt-PT', $h$<p>Assinatura mostra o plano atual do clube, o estado do período de teste e a próxima cobrança, permitindo trocar de plano.</p><p>Se o período de teste expirar sem assinatura ativa, o acesso fica limitado.</p>$h$,
  'es-ES', $h$<p>Suscripción muestra el plan actual del club, el estado del periodo de prueba y el próximo cobro, permitiendo cambiar de plan.</p><p>Si el periodo de prueba expira sin suscripción activa, el acceso queda limitado.</p>$h$,
  'fr-FR', $h$<p>Abonnement affiche le plan actuel du club, l'état de la période d'essai et la prochaine facturation, et permet de changer de plan.</p><p>Si la période d'essai expire sans abonnement actif, l'accès devient limité.</p>$h$
 ))

) AS v(cat_slug, slug, feature_key, route_key, sort_order, title_i18n, excerpt_i18n, content_i18n)
ON cat.slug = v.cat_slug
ON CONFLICT (slug) DO UPDATE SET
  title_i18n = EXCLUDED.title_i18n,
  excerpt_i18n = EXCLUDED.excerpt_i18n,
  content_i18n = EXCLUDED.content_i18n,
  feature_key = EXCLUDED.feature_key,
  route_key = EXCLUDED.route_key,
  status = 'published';
