import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomColor, randomEmoji } from '../common/unicorn';
import type { AppEnv } from '../config/env.validation';
import { REFRESH_GRACE_MS } from './auth.constants';

const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  emoji: true,
  color: true,
  avatarUrl: true,
  createdAt: true,
} as const;

const BCRYPT_COST = 12;
const SESSION_EXPIRED = 'Session expirée, reconnecte-toi.';

export interface SessionMeta {
  userAgent?: string;
}

type PublicUser = {
  id: string;
  email: string;
  name: string;
  emoji: string;
  color: string;
  avatarUrl: string | null;
  createdAt: Date;
};

export interface IssuedSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService<AppEnv, true>,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta = {}): Promise<IssuedSession> {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        password: await bcrypt.hash(dto.password, BCRYPT_COST),
        emoji: randomEmoji(),
        color: randomColor(),
      },
      select: PUBLIC_USER,
    });

    return this.issue(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');
    }

    const { password: _password, updatedAt: _updatedAt, ...safe } = user;
    return this.issue(safe, meta);
  }

  /** Échange un jeton de rafraîchissement contre une nouvelle session (rotation). */
  async refresh(rawToken: string | undefined, meta: SessionMeta = {}): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException(SESSION_EXPIRED);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: PUBLIC_USER } },
    });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    if (stored.revokedAt) {
      const sinceRevoked = Date.now() - stored.revokedAt.getTime();
      if (sinceRevoked > REFRESH_GRACE_MS) {
        // Réutilisation d'un jeton déjà échangé : possible vol, on coupe toutes les sessions.
        await this.revokeAll(stored.userId);
        throw new UnauthorizedException(SESSION_EXPIRED);
      }
    } else {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }

    return this.issue(stored.user, meta);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
  }

  private async issue(user: PublicUser, meta: SessionMeta): Promise<IssuedSession> {
    const days = this.config.get('REFRESH_TOKEN_DAYS', { infer: true });
    const now = Date.now();
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(now + days * 86_400_000);

    await this.prisma.$transaction([
      // Ménage : jetons expirés ou révoqués depuis plus d'un jour.
      this.prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lt: new Date(now) } },
            { revokedAt: { lt: new Date(now - 86_400_000) } },
          ],
        },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshExpiresAt,
          userAgent: meta.userAgent?.slice(0, 200),
        },
      }),
    ]);

    return {
      user,
      accessToken: this.jwt.sign({ sub: user.id }),
      refreshToken,
      refreshExpiresAt,
    };
  }
}
