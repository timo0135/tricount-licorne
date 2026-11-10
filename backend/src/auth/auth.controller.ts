import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, IssuedSession } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { DisableTwoFactorDto, TwoFactorCodeDto, TwoFactorLoginDto } from './dto/two-factor.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { AuthUser, CurrentUser } from './decorators/current-user.decorator';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';
import type { AppEnv } from '../config/env.validation';

/** 10 tentatives par minute et par adresse IP sur les routes d'identification. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @ApiOperation({ summary: 'Créer un compte' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.register(dto, this.meta(req)));
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Se connecter' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.meta(req));
    // Double authentification activée : pas de session avant le code.
    if ('twoFactorRequired' in result) return result;
    return this.respond(res, result);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login/2fa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deuxième étape de connexion : code à 6 chiffres ou code de secours' })
  async loginTwoFactor(
    @Body() dto: TwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(
      res,
      await this.auth.completeTwoFactor(dto.challengeToken, dto.code, this.meta(req)),
    );
  }

  @Get('2fa')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'État de la double authentification' })
  async twoFactorStatus(@CurrentUser() user: AuthUser) {
    const me = await this.auth.me(user.id);
    return {
      enabled: me.twoFactorEnabled,
      remainingRecoveryCodes: me.twoFactorEnabled
        ? await this.twoFactor.remainingRecoveryCodes(user.id)
        : 0,
    };
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Préparer l’activation : QR code à scanner' })
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.twoFactor.setup(user.id);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activer avec un premier code ; renvoie les codes de secours' })
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.enable(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Désactiver (mot de passe et code exigés)' })
  disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: DisableTwoFactorDto) {
    return this.twoFactor.disable(user.id, dto.password, dto.code);
  }

  @Post('2fa/recovery-codes')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer de nouveaux codes de secours (les anciens deviennent invalides)' })
  regenerateRecoveryCodes(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.regenerateRecoveryCodes(user.id, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renouveler la session à partir du cookie de rafraîchissement' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], this.meta(req)));
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Se déconnecter (révoque la session courante)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookie(res);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Pose le cookie HttpOnly et ne renvoie au client que l'utilisateur et le jeton d'accès. */
  private respond(res: Response, session: IssuedSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return { user: session.user, accessToken: session.accessToken };
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'] };
  }
}
