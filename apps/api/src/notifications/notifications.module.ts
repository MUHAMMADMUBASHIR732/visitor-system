import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeHtml } from '../common/normalize';
import { SERVERLESS } from '../common/runtime';
import type { SerializedVisit } from '../visits/visit.types';

const COLORS = {
  bean: '#2D211B',
  mocha: '#7B5A48',
  oat: '#E7D7C2',
  foam: '#F8F1E8',
  cinnamon: '#B9784D',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly tz: string;
  private readonly webUrl: string;

  constructor(private readonly config: ConfigService) {
    this.tz = config.get<string>('OFFICE_TIMEZONE') ?? 'Asia/Karachi';
    this.webUrl = (config.get<string>('WEB_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  private when(iso: string) {
    return new Date(iso).toLocaleString('en-GB', { timeZone: this.tz, dateStyle: 'medium', timeStyle: 'short' });
  }

  private layout(title: string, bodyHtml: string, action?: { label: string; url: string }) {
    const button = action
      ? `<p style="margin:28px 0 0"><a href="${escapeHtml(action.url)}" style="background:${COLORS.cinnamon};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(action.label)}</a></p>`
      : '';
    return `<!doctype html><html><body style="margin:0;background:${COLORS.oat};padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:${COLORS.bean}">
<div style="max-width:520px;margin:0 auto;background:${COLORS.foam};border-radius:20px;padding:32px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${COLORS.mocha}">Foyer</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>
${bodyHtml}${button}
</div></body></html>`;
  }

  /**
   * On a normal server emails are fire-and-forget. A serverless function can be frozen right after it
   * responds, so there the caller waits for the provider before replying.
   */
  private run(p: Promise<void>): Promise<void> {
    if (SERVERLESS) return p;
    void p;
    return Promise.resolve();
  }

  private async send(to: string, subject: string, html: string) {
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) {
      this.logger.log(`Email skipped (no RESEND_API_KEY): to=${to} subject="${subject}"`);
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get<string>('MAIL_FROM') ?? 'Foyer <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        }),
      });
      if (!res.ok) this.logger.warn(`Email provider answered ${res.status} for "${subject}"`);
    } catch (err) {
      this.logger.warn(`Email failed for "${subject}": ${(err as Error).message}`);
    }
  }

  /** Fire-and-forget: callers never wait for the email provider. */
  inviteVisitor(visit: SerializedVisit): Promise<void> {
    if (!visit.visitor.email || !visit.passToken) return Promise.resolve();
    const url = `${this.webUrl}/pass/${visit.passToken}`;
    const html = this.layout(
      `Your visit pass for ${visit.host.name}`,
      `<p style="margin:0 0 8px">Hi ${escapeHtml(visit.visitor.fullName)},</p>
<p style="margin:0 0 8px">${escapeHtml(visit.host.name)} is expecting you on <strong>${escapeHtml(this.when(visit.expectedFrom))}</strong>.</p>
<p style="margin:0 0 8px">Show the QR code on your pass at the front desk. If your phone is out of battery, give the guard this code: <strong style="letter-spacing:2px">${escapeHtml(visit.passCode ?? '')}</strong></p>`,
      { label: 'Open your pass', url },
    );
    return this.run(this.send(visit.visitor.email, `Your visit pass for ${visit.host.name}`, html));
  }

  /** A plain notification email in the Foyer layout. */
  simple(to: string, title: string, body: string): Promise<void> {
    const html = this.layout(title, `<p style="margin:0">${escapeHtml(body)}</p>`, { label: 'Open Foyer', url: this.webUrl });
    return this.run(this.send(to, title, html));
  }

  hostArrival(visit: SerializedVisit): Promise<void> {
    const html = this.layout(
      `${visit.visitor.fullName} has arrived`,
      `<p style="margin:0">${escapeHtml(visit.visitor.fullName)}${visit.visitor.company ? ` from ${escapeHtml(visit.visitor.company)}` : ''} checked in at reception for: ${escapeHtml(visit.purpose)}.</p>`,
    );
    return this.run(this.send(visit.host.email, `${visit.visitor.fullName} has arrived`, html));
  }

  hostWalkIn(visit: SerializedVisit): Promise<void> {
    const html = this.layout(
      `${visit.visitor.fullName} is at reception`,
      `<p style="margin:0">${escapeHtml(visit.visitor.fullName)}${visit.visitor.company ? ` from ${escapeHtml(visit.visitor.company)}` : ''} came without an appointment: ${escapeHtml(visit.purpose)}.</p>
<p style="margin:12px 0 0">Approve or decline the visit in Foyer.</p>`,
      { label: 'Review visit', url: `${this.webUrl}/host` },
    );
    return this.run(this.send(visit.host.email, `${visit.visitor.fullName} is at reception`, html));
  }
}

@Global()
@Module({ providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
