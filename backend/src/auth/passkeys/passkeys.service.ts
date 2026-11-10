import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppEnv } from '../../config/env.validation';
import { AuthService, SessionMeta } from '../auth.service';
import { ChallengeStore } from './challenge.store';
import { deviceNameFrom } from './device-name';

const RP_NAME = 'Licorne Tricount';
const MAX_PASSKEYS = 10;
const LOGIN_FAILED = 'Connexion avec la passkey impossible. Réessaie ou utilise ton mot de passe.';

const PASSKEY_SELECT = {
  id: true,
  name: true,
  deviceType: true,
  backedUp: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

/**
 * Passkeys (WebAuthn) : enregistrement depuis le profil, connexion sans mot de
 * passe. La vérification de l'utilisateur (Face ID, Touch ID, code de l'appareil)
 * est exigée : une passkey vaut donc à elle seule une double authentification.
 */
@Injectable()
export class PasskeysService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService<AppEnv, true>,
    private challenges: ChallengeStore,
    private auth: AuthService,
  ) {}

  private get rpID() {
    return this.config.get('WEBAUTHN_RP_ID', { infer: true });
  }

  private get origins() {
    return this.config.get('WEBAUTHN_ORIGINS', { infer: true });
  }

  list(userId: string) {
    return this.prisma.passkey.findMany({
      where: { userId },
      select: PASSKEY_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Étape 1 de l'enregistrement : options à passer au navigateur. */
  async registrationOptions(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, passkeys: { select: { credentialId: true, transports: true } } },
    });
    if (user.passkeys.length >= MAX_PASSKEYS) {
      throw new BadRequestException(`${MAX_PASSKEYS} passkeys maximum par compte.`);
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      // Pas deux passkeys sur le même appareil.
      excludeCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    this.challenges.add(options.challenge, userId);
    return options;
  }

  /** Étape 2 : vérifie la réponse de l'appareil et enregistre la clé publique. */
  async register(userId: string, response: RegistrationResponseJSON, meta: SessionMeta = {}) {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: (challenge) => this.challenges.consume(challenge, userId),
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new BadRequestException('Enregistrement de la passkey refusé. Réessaie.');
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Enregistrement de la passkey refusé. Réessaie.');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const exists = await this.prisma.passkey.findUnique({ where: { credentialId: credential.id } });
    if (exists) throw new BadRequestException('Cette passkey est déjà enregistrée.');

    return this.prisma.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: deviceNameFrom(meta.userAgent),
      },
      select: PASSKEY_SELECT,
    });
  }

  async rename(userId: string, id: string, name: string) {
    await this.findOwned(userId, id);
    return this.prisma.passkey.update({
      where: { id },
      data: { name: name.trim() },
      select: PASSKEY_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.passkey.delete({ where: { id } });
    return { deleted: true };
  }

  /** Connexion, étape 1 : défi à signer ; l'appareil propose ses passkeys pour ce site. */
  async authenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
      allowCredentials: [],
    });
    this.challenges.add(options.challenge);
    return options;
  }

  /** Connexion, étape 2 : vérifie la signature avec la clé publique enregistrée, ouvre la session. */
  async authenticate(response: AuthenticationResponseJSON, meta: SessionMeta = {}) {
    const passkey = await this.prisma.passkey.findUnique({ where: { credentialId: response.id } });
    if (!passkey) throw new UnauthorizedException(LOGIN_FAILED);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: (challenge) => this.challenges.consume(challenge),
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[],
        },
        requireUserVerification: true,
      });
    } catch {
      throw new UnauthorizedException(LOGIN_FAILED);
    }
    if (!verification.verified) throw new UnauthorizedException(LOGIN_FAILED);

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });
    return this.auth.sessionFor(passkey.userId, meta);
  }

  private async findOwned(userId: string, id: string) {
    const passkey = await this.prisma.passkey.findFirst({ where: { id, userId } });
    if (!passkey) throw new NotFoundException('Passkey introuvable.');
    return passkey;
  }
}
