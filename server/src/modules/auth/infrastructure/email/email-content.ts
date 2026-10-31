// Email copy deck: `{email}` is replaced with the recipient's address, everything
// else is literal. Changing wording here needs no template edit.
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'

export type EmailKind = 'verification' | 'reset'

export interface EmailContent {
  subject: string
  /** Hidden preview text shown by inbox clients. */
  preheader: string
  /** Small orange line above the title. */
  kicker: string
  title: string
  body: string
  cta: string
  expiry: string
  ignore: string
  footer: string
}

export const EMAIL_CONTENT: Record<EmailKind, Record<EmailLocale, EmailContent>> = {
  verification: {
    en: {
      subject: 'Verify your PacePilot email',
      preheader: 'One tap to finish your PacePilot account.',
      kicker: 'WELCOME TO PACEPILOT',
      title: 'Confirm your email',
      body: 'Tap the button below to verify {email} and finish setting up your account.',
      cta: 'Verify email',
      expiry: 'This link expires in 24 hours.',
      ignore: "If you didn't create a PacePilot account, you can ignore this email.",
      footer: 'PacePilot — every run, a reason.',
    },
    pt: {
      subject: 'Verifique o seu email no PacePilot',
      preheader: 'Um toque para terminar a sua conta PacePilot.',
      kicker: 'BEM-VINDO AO PACEPILOT',
      title: 'Confirme o seu email',
      body: 'Toque no botão abaixo para verificar {email} e terminar a configuração da sua conta.',
      cta: 'Verificar email',
      expiry: 'Este link expira em 24 horas.',
      ignore: 'Se não criou uma conta PacePilot, pode ignorar este email.',
      footer: 'PacePilot — cada corrida, uma razão.',
    },
  },
  reset: {
    en: {
      subject: 'Reset your PacePilot password',
      preheader: 'Choose a new password. This link expires in 30 minutes.',
      kicker: 'PASSWORD RESET',
      title: 'Choose a new password',
      body: 'We received a request to reset the password for {email}. This link works once.',
      cta: 'Reset password',
      expiry: 'This link expires in 30 minutes.',
      ignore: "If you didn't ask for this, ignore this email — your password stays the same.",
      footer: 'PacePilot — every run, a reason.',
    },
    pt: {
      subject: 'Redefina a sua palavra-passe do PacePilot',
      preheader: 'Escolha uma nova palavra-passe. Este link expira em 30 minutos.',
      kicker: 'REDEFINIR PALAVRA-PASSE',
      title: 'Escolha uma nova palavra-passe',
      body: 'Recebemos um pedido para redefinir a palavra-passe de {email}. Este link só funciona uma vez.',
      cta: 'Redefinir palavra-passe',
      expiry: 'Este link expira em 30 minutos.',
      ignore: 'Se não pediu isto, ignore este email — a sua palavra-passe mantém-se.',
      footer: 'PacePilot — cada corrida, uma razão.',
    },
  },
}
