// Email copy for the trial lifecycle, per language and stage. Kept beside the
// function rather than in the DB so a wording change ships as a deploy and is
// reviewable in git.

export type Lang = "pt-BR" | "pt-PT" | "en-US" | "es-ES" | "fr-FR";
export type Stage = "d3" | "d1" | "expired" | "winback3" | "winback10";

export interface Message {
  subject: string;
  heading: string;
  body: string;
  cta: string;
}

// Copy per language and stage. The pt-BR set is the primary market; the others
// mirror it. `club` is the club's own name, `days` the days left on the trial.
export interface LangCopy {
  greeting: (name: string) => string;
  signoff: string;
  footer: string;
  stages: Record<Stage, (club: string, days: number) => Message>;
}

export const COPY: Record<Lang, LangCopy> = {
  "pt-BR": {
    greeting: (name) => name ? `Olá, ${name}!` : "Olá!",
    signoff: "Qualquer dúvida, responda este e-mail — eu leio pessoalmente.",
    footer: "Aura Club Manager — gestão completa para clubes e escolinhas",
    stages: {
      d3: (club, days) => ({
        subject: `Faltam ${days} dias de teste do ${club}`,
        heading: `Seu teste termina em ${days} dias`,
        body: `O teste do <strong>${club}</strong> no Aura termina em ${days} dias. Depois disso o acesso é bloqueado e seus dados ficam guardados esperando você voltar.<br/><br/>Se quiser continuar, dá para assinar em menos de dois minutos — PIX, boleto ou cartão.`,
        cta: "Ver planos e assinar",
      }),
      d1: (club) => ({
        subject: `Último dia de teste do ${club}`,
        heading: "Seu teste termina amanhã",
        body: `Amanhã o teste do <strong>${club}</strong> acaba e o acesso será bloqueado. Nada é apagado — seus atletas, treinos e lançamentos continuam aqui quando você voltar.<br/><br/>Para não perder o ritmo, assine hoje. Leva dois minutos e aceita PIX.`,
        cta: "Assinar agora",
      }),
      expired: (club) => ({
        subject: `O teste do ${club} terminou`,
        heading: "Seu teste terminou",
        body: `O período de teste do <strong>${club}</strong> chegou ao fim e o acesso está bloqueado. Tudo que você cadastrou está intacto e volta no instante em que você assinar.<br/><br/>O plano Aura Club sai por <strong>R$ 97/mês</strong>, ou R$ 970 no ano — dois meses grátis.`,
        cta: "Reativar meu acesso",
      }),
      winback3: (club) => ({
        subject: `Posso ajudar a configurar o ${club}?`,
        heading: "Precisa de uma mão para começar?",
        body: `Vi que o teste do <strong>${club}</strong> terminou sem você assinar, e na maioria das vezes o motivo é o mesmo: dá trabalho cadastrar todos os atletas no começo.<br/><br/>Se for isso, eu faço a migração para você — manda sua planilha e eu subo tudo. Sem custo e sem compromisso de assinar.`,
        cta: "Quero ajuda com a migração",
      }),
      winback10: (club) => ({
        subject: `Última mensagem sobre o ${club}`,
        heading: "Vou parar de escrever",
        body: `Esta é minha última mensagem sobre o <strong>${club}</strong> — não quero encher sua caixa de entrada.<br/><br/>Seus dados continuam guardados, então se um dia quiser voltar, é só entrar e assinar: está tudo onde você deixou. E se o Aura não serviu, eu agradeço se você me contar o motivo em uma linha. Ajuda muito.`,
        cta: "Entrar na minha conta",
      }),
    },
  },

  "pt-PT": {
    greeting: (name) => name ? `Olá, ${name}!` : "Olá!",
    signoff: "Qualquer dúvida, responda a este e-mail — leio pessoalmente.",
    footer: "Aura Club Manager — gestão completa para clubes e escolas de futebol",
    stages: {
      d3: (club, days) => ({
        subject: `Faltam ${days} dias de teste do ${club}`,
        heading: `O seu teste termina em ${days} dias`,
        body: `O teste do <strong>${club}</strong> no Aura termina em ${days} dias. Depois disso o acesso é bloqueado e os seus dados ficam guardados à sua espera.<br/><br/>Se quiser continuar, pode subscrever em menos de dois minutos.`,
        cta: "Ver planos e subscrever",
      }),
      d1: (club) => ({
        subject: `Último dia de teste do ${club}`,
        heading: "O seu teste termina amanhã",
        body: `Amanhã o teste do <strong>${club}</strong> acaba e o acesso será bloqueado. Nada é apagado — os seus atletas, treinos e lançamentos continuam aqui.<br/><br/>Para não perder o ritmo, subscreva hoje.`,
        cta: "Subscrever agora",
      }),
      expired: (club) => ({
        subject: `O teste do ${club} terminou`,
        heading: "O seu teste terminou",
        body: `O período de teste do <strong>${club}</strong> chegou ao fim e o acesso está bloqueado. Tudo o que registou está intacto e regressa no momento em que subscrever.`,
        cta: "Reativar o meu acesso",
      }),
      winback3: (club) => ({
        subject: `Posso ajudar a configurar o ${club}?`,
        heading: "Precisa de ajuda para começar?",
        body: `Vi que o teste do <strong>${club}</strong> terminou sem subscrição, e quase sempre o motivo é o mesmo: dá trabalho registar todos os atletas no início.<br/><br/>Se for esse o caso, faço a migração por você — envie a sua folha de cálculo e eu carrego tudo. Sem custo.`,
        cta: "Quero ajuda com a migração",
      }),
      winback10: (club) => ({
        subject: `Última mensagem sobre o ${club}`,
        heading: "Vou deixar de escrever",
        body: `Esta é a minha última mensagem sobre o <strong>${club}</strong>.<br/><br/>Os seus dados continuam guardados, por isso se um dia quiser voltar basta entrar e subscrever. E se o Aura não serviu, agradeço que me diga o motivo numa linha.`,
        cta: "Entrar na minha conta",
      }),
    },
  },

  "en-US": {
    greeting: (name) => name ? `Hi ${name},` : "Hi there,",
    signoff: "Any questions, just reply to this email — I read every one.",
    footer: "Aura Club Manager — complete management for clubs and academies",
    stages: {
      d3: (club, days) => ({
        subject: `${days} days left on your ${club} trial`,
        heading: `Your trial ends in ${days} days`,
        body: `Your <strong>${club}</strong> trial ends in ${days} days. After that access is locked, and your data sits safely waiting for you.<br/><br/>If you want to keep going, subscribing takes under two minutes.`,
        cta: "See plans and subscribe",
      }),
      d1: (club) => ({
        subject: `Last day of your ${club} trial`,
        heading: "Your trial ends tomorrow",
        body: `Tomorrow your <strong>${club}</strong> trial ends and access will be locked. Nothing gets deleted — your athletes, sessions and finances stay right where they are.<br/><br/>Subscribe today to keep your momentum.`,
        cta: "Subscribe now",
      }),
      expired: (club) => ({
        subject: `Your ${club} trial has ended`,
        heading: "Your trial has ended",
        body: `The trial period for <strong>${club}</strong> is over and access is locked. Everything you set up is intact and comes back the moment you subscribe.`,
        cta: "Reactivate my access",
      }),
      winback3: (club) => ({
        subject: `Can I help you set up ${club}?`,
        heading: "Need a hand getting started?",
        body: `I noticed your <strong>${club}</strong> trial ended without subscribing, and usually it comes down to the same thing: getting every athlete into the system is real work up front.<br/><br/>If that is it, I will do the migration for you — send me your spreadsheet and I will load it all in. No charge, no commitment.`,
        cta: "I'd like help migrating",
      }),
      winback10: (club) => ({
        subject: `Last note about ${club}`,
        heading: "I'll stop writing",
        body: `This is my last message about <strong>${club}</strong> — I won't keep filling your inbox.<br/><br/>Your data stays saved, so if you ever want to come back, just sign in and subscribe. And if Aura wasn't the right fit, I'd be grateful for one line telling me why.`,
        cta: "Sign in to my account",
      }),
    },
  },

  "es-ES": {
    greeting: (name) => name ? `¡Hola, ${name}!` : "¡Hola!",
    signoff: "Cualquier duda, responde a este correo — lo leo personalmente.",
    footer: "Aura Club Manager — gestión completa para clubes y escuelas de fútbol",
    stages: {
      d3: (club, days) => ({
        subject: `Quedan ${days} días de prueba de ${club}`,
        heading: `Tu prueba termina en ${days} días`,
        body: `La prueba de <strong>${club}</strong> en Aura termina en ${days} días. Después el acceso se bloquea y tus datos quedan guardados esperándote.<br/><br/>Si quieres continuar, suscribirse lleva menos de dos minutos.`,
        cta: "Ver planes y suscribirme",
      }),
      d1: (club) => ({
        subject: `Último día de prueba de ${club}`,
        heading: "Tu prueba termina mañana",
        body: `Mañana termina la prueba de <strong>${club}</strong> y el acceso se bloqueará. Nada se borra — tus deportistas, entrenamientos y finanzas siguen aquí.<br/><br/>Suscríbete hoy para no perder el ritmo.`,
        cta: "Suscribirme ahora",
      }),
      expired: (club) => ({
        subject: `La prueba de ${club} ha terminado`,
        heading: "Tu prueba ha terminado",
        body: `El período de prueba de <strong>${club}</strong> ha finalizado y el acceso está bloqueado. Todo lo que configuraste está intacto y vuelve en el momento en que te suscribas.`,
        cta: "Reactivar mi acceso",
      }),
      winback3: (club) => ({
        subject: `¿Te ayudo a configurar ${club}?`,
        heading: "¿Necesitas una mano para empezar?",
        body: `Vi que la prueba de <strong>${club}</strong> terminó sin suscripción, y casi siempre el motivo es el mismo: dar de alta a todos los deportistas da trabajo al principio.<br/><br/>Si es eso, yo hago la migración por ti — mándame tu hoja de cálculo y lo subo todo. Sin coste ni compromiso.`,
        cta: "Quiero ayuda con la migración",
      }),
      winback10: (club) => ({
        subject: `Último mensaje sobre ${club}`,
        heading: "Dejaré de escribir",
        body: `Este es mi último mensaje sobre <strong>${club}</strong>.<br/><br/>Tus datos siguen guardados, así que si algún día quieres volver, solo entra y suscríbete. Y si Aura no te sirvió, te agradecería una línea contándome por qué.`,
        cta: "Entrar en mi cuenta",
      }),
    },
  },

  "fr-FR": {
    greeting: (name) => name ? `Bonjour ${name},` : "Bonjour,",
    signoff: "Une question ? Répondez à cet e-mail — je le lis personnellement.",
    footer: "Aura Club Manager — gestion complète pour clubs et écoles de football",
    stages: {
      d3: (club, days) => ({
        subject: `Il reste ${days} jours d'essai pour ${club}`,
        heading: `Votre essai se termine dans ${days} jours`,
        body: `L'essai de <strong>${club}</strong> sur Aura se termine dans ${days} jours. Ensuite l'accès est bloqué et vos données restent conservées en attendant votre retour.<br/><br/>Pour continuer, l'abonnement prend moins de deux minutes.`,
        cta: "Voir les forfaits et m'abonner",
      }),
      d1: (club) => ({
        subject: `Dernier jour d'essai pour ${club}`,
        heading: "Votre essai se termine demain",
        body: `Demain l'essai de <strong>${club}</strong> se termine et l'accès sera bloqué. Rien n'est supprimé — vos athlètes, séances et finances restent en place.<br/><br/>Abonnez-vous aujourd'hui pour ne pas perdre votre élan.`,
        cta: "M'abonner maintenant",
      }),
      expired: (club) => ({
        subject: `L'essai de ${club} est terminé`,
        heading: "Votre essai est terminé",
        body: `La période d'essai de <strong>${club}</strong> est arrivée à son terme et l'accès est bloqué. Tout ce que vous avez configuré est intact et revient dès votre abonnement.`,
        cta: "Réactiver mon accès",
      }),
      winback3: (club) => ({
        subject: `Puis-je vous aider à configurer ${club} ?`,
        heading: "Besoin d'un coup de main pour démarrer ?",
        body: `J'ai vu que l'essai de <strong>${club}</strong> s'est terminé sans abonnement, et la raison est presque toujours la même : saisir tous les athlètes représente du travail au départ.<br/><br/>Si c'est le cas, je fais la migration pour vous — envoyez-moi votre tableur et je charge le tout. Sans frais ni engagement.`,
        cta: "Je veux de l'aide pour migrer",
      }),
      winback10: (club) => ({
        subject: `Dernier message au sujet de ${club}`,
        heading: "Je vais arrêter d'écrire",
        body: `Ceci est mon dernier message au sujet de <strong>${club}</strong>.<br/><br/>Vos données restent conservées : si un jour vous souhaitez revenir, il suffit de vous connecter et de vous abonner. Et si Aura ne vous a pas convenu, un mot sur la raison m'aiderait beaucoup.`,
        cta: "Accéder à mon compte",
      }),
    },
  },
};

export function resolveLang(value: unknown): Lang {
  return (typeof value === "string" && value in COPY) ? (value as Lang) : "pt-BR";
}

export function renderHtml(L: LangCopy, msg: Message, ownerName: string, ctaUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px">
      <p>${L.greeting(ownerName)}</p>
      <h2 style="font-size:19px;margin:18px 0 10px;color:#111827">${msg.heading}</h2>
      <p>${msg.body}</p>
      <p style="margin:26px 0">
        <a href="${ctaUrl}"
           style="background:#2f93ff;color:#ffffff;padding:13px 26px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">
          ${msg.cta}
        </a>
      </p>
      <p style="color:#6b7280">${L.signoff}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px;">${L.footer}<br/>
        <a href="${ctaUrl}" style="color:#9ca3af">${ctaUrl}</a>
      </p>
    </div>
  `;
}

