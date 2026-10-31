// Layout only; copy lives in `email-content.ts`. Tables and inline styles only —
// Gmail/Outlook strip external CSS and not every client renders SVG, hence the PNG logo.
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'
import {
  EMAIL_CONTENT,
  type EmailKind,
} from '@/modules/auth/infrastructure/email/email-content.ts'

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
  return `${escapeHtml(before)}<strong style="color:#0B0B0F;font-weight:600">${escapeHtml(email)}</strong>${escapeHtml(after)}`
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
  const copy = EMAIL_CONTENT[kind][locale]
  const safeUrl = escapeHtml(url)
  const logoUrl = escapeHtml(`${env.appUrl}/icon-192.png`)

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0;vertical-align:middle;">
                    <img src="${logoUrl}" width="36" height="36" alt="PacePilot" style="display:block;width:36px;height:36px;border:0;border-radius:8px;outline:none;text-decoration:none;">
                  </td>
                  <td style="padding:0 0 0 12px;vertical-align:middle;">
                    <span style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:0.02em;color:#0B0B0F;">PacePilot</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 32px 0 32px;">
              <p style="margin:0 0 10px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:13px;font-weight:700;letter-spacing:0.08em;color:#F97316;">${escapeHtml(copy.kicker)}</p>
              <h1 style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:800;color:#0B0B0F;">${escapeHtml(copy.title)}</h1>
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3F3F46;">${bodyWithEmail(copy.body, email)}</p>
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
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717A;">${escapeHtml(copy.expiry)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0 32px;">
              <p style="margin:0 0 8px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717A;">${escapeHtml(copy.ignore)}</p>
              <p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717A;word-break:break-all;">
                <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#C2410C;text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 32px 30px 32px;">
              <div style="border-top:1px solid #E4E4E7;padding-top:18px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#71717A;">${escapeHtml(copy.footer)}</div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#A1A1AA;">PacePilot</p>
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
