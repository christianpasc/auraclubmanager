// Copy for the two authentication emails, in the five languages Aura ships.
//
// Shared by send-email-verification and send-password-reset. Kept beside the
// functions rather than in the database so a wording change ships as a deploy
// and is reviewable in git — the same reasoning as send-trial-emails/copy.ts.
//
// Supabase Auth could only ever hold one template per email type, in one
// language. That alone made it the wrong place for these: a French club was
// being asked in English to confirm an address.

export type Lang = "pt-BR" | "pt-PT" | "en-US" | "es-ES" | "fr-FR";

const LANGS: Lang[] = ["pt-BR", "pt-PT", "en-US", "es-ES", "fr-FR"];

/** Falls back within the same language before falling back to pt-BR. */
export function resolveLang(raw: string | null | undefined): Lang {
  const value = (raw || "").trim();
  if (LANGS.includes(value as Lang)) return value as Lang;

  const base = value.split("-")[0].toLowerCase();
  const sameBase = LANGS.find((l) => l.split("-")[0] === base);
  return sameBase ?? "pt-BR";
}

export interface AuthMessage {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  linkFallback: string;
  footer: string;
  greeting: (name: string) => string;
  signoff?: string;
}

export interface AuthCopy {
  verification: AuthMessage;
  passwordReset: AuthMessage;
}

const FOOTER: Record<Lang, string> = {
  "pt-BR": "Aura Club Manager — gestão completa para clubes e escolinhas",
  "pt-PT": "Aura Club Manager — gestão completa para clubes e escolas de futebol",
  "en-US": "Aura Club Manager — complete management for clubs and academies",
  "es-ES": "Aura Club Manager — gestión completa para clubes y escuelas",
  "fr-FR": "Aura Club Manager — la gestion complète des clubs et des académies",
};

export const AUTH_COPY: Record<Lang, AuthCopy> = {
  "pt-BR": {
    verification: {
      subject: "Confirme seu e-mail no Aura",
      heading: "Falta só confirmar seu e-mail",
      body:
        "Sua conta já está ativa e você pode usar o Aura normalmente. Confirmar o e-mail libera o envio de convites e cobranças para os responsáveis, e garante que você consiga recuperar a conta depois.",
      cta: "Confirmar meu e-mail",
      linkFallback: "Se o botão não funcionar, abra este endereço:",
      footer: FOOTER["pt-BR"],
      greeting: (name) => (name ? `Olá, ${name}!` : "Olá!"),
      signoff: "O link vale por 24 horas.",
    },
    passwordReset: {
      subject: "Redefinir sua senha do Aura",
      heading: "Criar uma nova senha",
      body:
        "Recebemos um pedido para redefinir a senha da sua conta no Aura. Clique no botão abaixo para escolher uma nova senha.",
      cta: "Criar nova senha",
      linkFallback: "Se o botão não funcionar, abra este endereço:",
      footer: FOOTER["pt-BR"],
      greeting: (name) => (name ? `Olá, ${name}!` : "Olá!"),
      signoff:
        "O link vale por 1 hora. Se não foi você que pediu, ignore este e-mail — sua senha atual continua valendo.",
    },
  },

  "pt-PT": {
    verification: {
      subject: "Confirme o seu e-mail no Aura",
      heading: "Falta apenas confirmar o seu e-mail",
      body:
        "A sua conta já está ativa e pode usar o Aura normalmente. Confirmar o e-mail permite enviar convites e cobranças aos encarregados de educação, e garante que consegue recuperar a conta mais tarde.",
      cta: "Confirmar o meu e-mail",
      linkFallback: "Se o botão não funcionar, abra este endereço:",
      footer: FOOTER["pt-PT"],
      greeting: (name) => (name ? `Olá, ${name}!` : "Olá!"),
      signoff: "O link é válido por 24 horas.",
    },
    passwordReset: {
      subject: "Redefinir a sua palavra-passe do Aura",
      heading: "Criar uma nova palavra-passe",
      body:
        "Recebemos um pedido para redefinir a palavra-passe da sua conta no Aura. Clique no botão abaixo para escolher uma nova.",
      cta: "Criar nova palavra-passe",
      linkFallback: "Se o botão não funcionar, abra este endereço:",
      footer: FOOTER["pt-PT"],
      greeting: (name) => (name ? `Olá, ${name}!` : "Olá!"),
      signoff:
        "O link é válido por 1 hora. Se não foi você que pediu, ignore este e-mail — a sua palavra-passe atual continua válida.",
    },
  },

  "en-US": {
    verification: {
      subject: "Confirm your email on Aura",
      heading: "Just one thing left: confirm your email",
      body:
        "Your account is already active and you can use Aura right away. Confirming your email unlocks sending invitations and invoices to guardians, and makes sure you can recover your account later.",
      cta: "Confirm my email",
      linkFallback: "If the button does not work, open this address:",
      footer: FOOTER["en-US"],
      greeting: (name) => (name ? `Hello, ${name}!` : "Hello!"),
      signoff: "This link is valid for 24 hours.",
    },
    passwordReset: {
      subject: "Reset your Aura password",
      heading: "Create a new password",
      body:
        "We received a request to reset the password on your Aura account. Use the button below to choose a new one.",
      cta: "Create new password",
      linkFallback: "If the button does not work, open this address:",
      footer: FOOTER["en-US"],
      greeting: (name) => (name ? `Hello, ${name}!` : "Hello!"),
      signoff:
        "This link is valid for 1 hour. If you did not request it, ignore this email — your current password still works.",
    },
  },

  "es-ES": {
    verification: {
      subject: "Confirma tu correo en Aura",
      heading: "Solo falta confirmar tu correo",
      body:
        "Tu cuenta ya está activa y puedes usar Aura con normalidad. Confirmar el correo habilita el envío de invitaciones y cobros a los tutores, y garantiza que puedas recuperar la cuenta más adelante.",
      cta: "Confirmar mi correo",
      linkFallback: "Si el botón no funciona, abre esta dirección:",
      footer: FOOTER["es-ES"],
      greeting: (name) => (name ? `¡Hola, ${name}!` : "¡Hola!"),
      signoff: "El enlace es válido durante 24 horas.",
    },
    passwordReset: {
      subject: "Restablecer tu contraseña de Aura",
      heading: "Crear una nueva contraseña",
      body:
        "Recibimos una solicitud para restablecer la contraseña de tu cuenta en Aura. Usa el botón de abajo para elegir una nueva.",
      cta: "Crear nueva contraseña",
      linkFallback: "Si el botón no funciona, abre esta dirección:",
      footer: FOOTER["es-ES"],
      greeting: (name) => (name ? `¡Hola, ${name}!` : "¡Hola!"),
      signoff:
        "El enlace es válido durante 1 hora. Si no lo solicitaste, ignora este correo: tu contraseña actual sigue siendo válida.",
    },
  },

  "fr-FR": {
    verification: {
      subject: "Confirmez votre e-mail sur Aura",
      heading: "Il ne reste qu'à confirmer votre e-mail",
      body:
        "Votre compte est déjà actif et vous pouvez utiliser Aura dès maintenant. Confirmer votre e-mail débloque l'envoi des invitations et des factures aux responsables, et vous assure de pouvoir récupérer votre compte plus tard.",
      cta: "Confirmer mon e-mail",
      linkFallback: "Si le bouton ne fonctionne pas, ouvrez cette adresse :",
      footer: FOOTER["fr-FR"],
      greeting: (name) => (name ? `Bonjour ${name} !` : "Bonjour !"),
      signoff: "Ce lien est valable 24 heures.",
    },
    passwordReset: {
      subject: "Réinitialiser votre mot de passe Aura",
      heading: "Créer un nouveau mot de passe",
      body:
        "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Aura. Utilisez le bouton ci-dessous pour en choisir un nouveau.",
      cta: "Créer un nouveau mot de passe",
      linkFallback: "Si le bouton ne fonctionne pas, ouvrez cette adresse :",
      footer: FOOTER["fr-FR"],
      greeting: (name) => (name ? `Bonjour ${name} !` : "Bonjour !"),
      signoff:
        "Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valide.",
    },
  },
};
