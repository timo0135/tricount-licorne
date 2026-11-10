import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AppEnv } from '../config/env.validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService<AppEnv, true>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: { sub: string; purpose?: string }) {
    // Un jeton d'étape de double authentification n'ouvre jamais l'accès à l'API.
    if (payload.purpose) throw new UnauthorizedException('Session expirée, reconnecte-toi.');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, emoji: true, color: true, avatarUrl: true },
    });
    if (!user) throw new UnauthorizedException('Ce compte n’existe plus.');
    return user;
  }
}
