export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class UnavailableEmailProvider implements EmailProvider {
  async send(): Promise<void> {
    throw new Error('No email provider configured (set EMAIL_PROVIDER and RESEND_API_KEY).');
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': message.idempotencyKey,
      },
      body: JSON.stringify({ from: this.from, to: message.to, subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
  }
}
