import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import type { AppEnv } from '../config/env.validation';
import { decryptSecret, encryptSecret } from './crypto.util';

/** Accepte le code précédent et le suivant (décalage d'horloge de ± 30 s). */
authenticator.options = { window: 1, step: 30, digits: 6 };

const ISSUER = 'Licorne Tricount';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const INVALID_CODE = 'Code incorrect ou expiré.';

const normalizeRecovery = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');
export const hashRecoveryCode = (code: string) =>
  createHash('sha256').update(normalizeRecovery(code)).digest('hex');

/** Code de secours lisible : « k7mq-2xpw ». */
export function generateRecoveryCode(): string {
  const pick = () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join('');
  return `${part()}-${part()}`;
}

/** Pas de 30 s courant, utilisé pour refuser la réutilisation d'un code. */
const currentStep = (now = Date.now()) => Math.floor(now / 30_000);

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService<AppEnv, true>,
  ) {}

  private get key() {
    return this.config.get('ENCRYPTION_KEY', { infer: true });
  }

  /** Étape 1 : nouveau secret en attente, QR code à scanner dans l'application d'authentification. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, totpEnabledAt: true },
    });
    if (user.totpEnabledAt) {
      throw new BadRequestException('La double authentification est déjà activée.');
    }

    const secret = authenticator.generateSecret(20);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpPendingSecret: encryptSecret(secret, this.key) },
    });

    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    return {
      otpauthUrl,
      qrCode: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 }),
      // Pour une saisie à la main, par groupes de 4 caractères.
      secret: secret.match(/.{1,4}/g)!.join(' '),
    };
  }

  /** Étape 2 : le premier code valide confirme l'activation ; renvoie les codes de secours. */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpPendingSecret: true, totpEnabledAt: true },
    });
    if (user.totpEnabledAt) {
      throw new BadRequestException('La double authentification est déjà activée.');
    }
    if (!user.totpPendingSecret) {
      throw new BadRequestException('Recommence l’activation : aucun QR code en attente.');
    }

    const secret = decryptSecret(user.totpPendingSecret, this.key);
    const step = this.matchStep(code, secret);
    if (step === null) throw new BadRequestException(INVALID_CODE);

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          totpSecret: user.totpPendingSecret,
          totpPendingSecret: null,
          totpEnabledAt: new Date(),
          totpLastStep: step,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
      }),
    ]);
    return { recoveryCodes };
  }

  /** Désactivation : mot de passe + code (ou code de secours) exigés. */
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true, totpEnabledAt: true },
    });
    if (!user.totpEnabledAt) {
      throw new BadRequestException('La double authentification n’est pas activée.');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }
    if (!(await this.verify(userId, code))) throw new UnauthorizedException(INVALID_CODE);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
    ]);
    return { disabled: true };
  }

  /** Nouveaux codes de secours (les anciens deviennent invalides). */
  async regenerateRecoveryCodes(userId: string, code: string) {
    if (!(await this.verify(userId, code, { allowRecovery: false }))) {
      throw new UnauthorizedException(INVALID_CODE);
    }
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })),
      }),
    ]);
    return { recoveryCodes };
  }

  async remainingRecoveryCodes(userId: string) {
    return this.prisma.recoveryCode.count({ where: { userId, usedAt: null } });
  }

  /**
   * Vérifie un code à 6 chiffres (jamais deux fois le même) ou, à défaut, un code
   * de secours (consommé). Renvoie vrai si l'accès est accordé.
   */
  async verify(userId: string, rawCode: string, { allowRecovery = true } = {}): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true },
    });
    if (!user?.totpEnabledAt || !user.totpSecret) return false;

    const code = rawCode.trim();
    if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      const step = this.matchStep(code.replace(/\s/g, ''), decryptSecret(user.totpSecret, this.key));
      if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) return false;
      // Mise à jour conditionnelle : deux requêtes simultanées ne peuvent pas utiliser le même code.
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step },
      });
      return count === 1;
    }

    if (!allowRecovery) return false;
    const { count } = await this.prisma.recoveryCode.updateMany({
      where: { userId, codeHash: hashRecoveryCode(code), usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }

  /** Pas de temps correspondant au code, ou null s'il est invalide. */
  private matchStep(code: string, secret: string): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const delta = authenticator.checkDelta(code, secret);
    return delta === null ? null : currentStep() + delta;
  }
}
