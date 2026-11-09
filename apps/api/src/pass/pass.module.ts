import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Visit passes are short signed tokens: v1.<visitId>.<expiryUnix>.<signature>.
 * Nothing sensitive is stored in the QR code, and a tampered token fails verification.
 * Whether a pass can still be used is decided from the visit's status in the database.
 */
@Injectable()
export class PassService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('QR_SECRET') ?? `${config.getOrThrow<string>('JWT_SECRET')}:qr`;
  }

  private signature(visitId: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`v1.${visitId}.${exp}`).digest('base64url').slice(0, 22);
  }

  sign(visitId: string, expiresAt: Date): string {
    const exp = Math.floor(expiresAt.getTime() / 1000);
    return `v1.${visitId}.${exp}.${this.signature(visitId, exp)}`;
  }

  verify(token: string): { visitId: string; exp: number } | null {
    const parts = token.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    const [, visitId, expRaw, sig] = parts;
    const exp = Number(expRaw);
    if (!Number.isInteger(exp)) return null;
    const expected = Buffer.from(this.signature(visitId, exp));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return { visitId, exp };
  }
}

@Global()
@Module({ providers: [PassService], exports: [PassService] })
export class PassModule {}
