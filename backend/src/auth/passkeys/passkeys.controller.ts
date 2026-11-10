import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { Public } from '../decorators/public.decorator';
import { AuthUser, CurrentUser } from '../decorators/current-user.decorator';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../auth.constants';
import type { AppEnv } from '../../config/env.validation';
import { PasskeysService } from './passkeys.service';

class WebAuthnResponseDto {
  /** Réponse brute du navigateur (validée par SimpleWebAuthn). */
  @IsObject()
  response: Record<string, unknown>;
}

class RenamePasskeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;
}

@ApiTags('passkeys')
@Controller('auth/passkeys')
export class PasskeysController {
  constructor(
    private readonly passkeys: PasskeysService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mes passkeys' })
  list(@CurrentUser() user: AuthUser) {
    return this.passkeys.list(user.id);
  }

  @Post('register/options')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enregistrer une passkey, étape 1 : options WebAuthn' })
  registrationOptions(@CurrentUser() user: AuthUser) {
    return this.passkeys.registrationOptions(user.id);
  }

  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enregistrer une passkey, étape 2 : réponse de l’appareil' })
  register(@CurrentUser() user: AuthUser, @Body() dto: WebAuthnResponseDto, @Req() req: Request) {
    return this.passkeys.register(
      user.id,
      dto.response as unknown as RegistrationResponseJSON,
      { userAgent: req.headers['user-agent'] },
    );
  }

  @Patch(':id')
  @ApiBearerAuth()
  rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenamePasskeyDto) {
    return this.passkeys.rename(user.id, id, dto.name);
  }

  @Delete(':id')
  @ApiBearerAuth()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.passkeys.remove(user.id, id);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login/options')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion par passkey, étape 1 : défi à signer' })
  authenticationOptions() {
    return this.passkeys.authenticationOptions();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion par passkey, étape 2 : ouvre la session' })
  async authenticate(
    @Body() dto: WebAuthnResponseDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.passkeys.authenticate(
      dto.response as unknown as AuthenticationResponseJSON,
      { userAgent: req.headers['user-agent'] },
    );
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return { user: session.user, accessToken: session.accessToken };
  }
}
