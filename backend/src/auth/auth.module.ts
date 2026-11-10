import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TwoFactorService } from './two-factor.service';
import { PasskeysService } from './passkeys/passkeys.service';
import { PasskeysController } from './passkeys/passkeys.controller';
import { ChallengeStore } from './passkeys/challenge.store';
import type { AppEnv } from '../config/env.validation';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController, PasskeysController],
  providers: [AuthService, JwtStrategy, TwoFactorService, PasskeysService, ChallengeStore],
  exports: [AuthService],
})
export class AuthModule {}
