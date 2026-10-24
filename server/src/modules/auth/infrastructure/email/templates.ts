/**
 * Transactional email templates.
 *
 * Email clients do not support the app's Tailwind layer, so the design tokens
 * are restated as inline hex values from `client/tailwind.config.js`:
 * background #0B0B0F, card #141419, border #27272A, primary #F97316,
 * ink #CECED3, muted #A1A1AA. Tables and inline styles only — no external CSS,
 * images or scripts, because Gmail/Outlook strip them.
 */
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'

export type EmailKind = 'verification' | 'reset'

interface EmailCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  body: string
  cta: string
  expiry: string
  ignore: string
  footer: string
}

interface CopySet {
  verification: EmailCopy
  reset: EmailCopy
}

const COPY: Record<EmailLocale, CopySet> = {
  en: {
    verification: {
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
    reset: {
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
  },
  pt: {
    verification: {
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
    reset: {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char] ?? char
  })
}

function bodyWithEmail(template: string, email: string): string {
  // Split and escape the address separately so the literal stays readable.
  const [before, after = ''] = template.split('{email}')
  return `${escapeHtml(before)}<strong style="color:#ffffff;font-weight:600">${escapeHtml(email)}</strong>${escapeHtml(after)}`
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function renderEmail(
  kind: EmailKind,
  locale: EmailLocale,
  url: string,
  email: string,
): RenderedEmail {
  const copy = COPY[locale][kind]
  const safeUrl = escapeHtml(url)

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0B0B0F;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0B0B0F;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0B0F;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141419;border:1px solid #27272A;border-radius:10px;">
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <span style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:0.02em;color:#ffffff;">PacePilot</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <p style="margin:0 0 10px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:13px;font-weight:700;letter-spacing:0.08em;color:#F97316;">${escapeHtml(copy.kicker)}</p>
              <h1 style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">${escapeHtml(copy.title)}</h1>
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#CECED3;">${bodyWithEmail(copy.body, email)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#F97316" style="border-radius:8px;">
                    <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(copy.cta)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 0 32px;">
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#A1A1AA;">${escapeHtml(copy.expiry)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p style="margin:0 0 8px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#A1A1AA;">${escapeHtml(copy.ignore)}</p>
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#A1A1AA;word-break:break-all;">
                <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#F97316;text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 30px 32px;">
              <div style="border-top:1px solid #27272A;padding-top:18px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#74747F;">${escapeHtml(copy.footer)}</div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#74747F;">PacePilot</p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    copy.title,
    '',
    copy.body.replace('{email}', email),
    '',
    url,
    '',
    copy.expiry,
    copy.ignore,
    '',
    copy.footer,
  ].join('\n')

  return { subject: copy.subject, html, text }
}
