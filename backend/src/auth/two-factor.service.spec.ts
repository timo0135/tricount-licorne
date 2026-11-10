import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { decryptSecret, encryptSecret } from './crypto.util';
import { TwoFactorService, generateRecoveryCode, hashRecoveryCode } from './two-factor.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const KEY = 'cle-de-test';

/** Base en mémoire, juste ce qu'il faut pour ces tests. */
function fakePrisma(password: string) {
  const user: Record<string, any> = {
    id: 'u1',
    email: 'timo@mail.com',
    name: 'Timo',
    emoji: '🦄',
    color: '#fff',
    avatarUrl: null,
    createdAt: new Date(),
    password: bcrypt.hashSync(password, 4),
    totpSecret: null,
    totpPendingSecret: null,
    totpEnabledAt: null,
    totpLastStep: null,
  };
  let codes: { codeHash: string; usedAt: Date | null; userId: string }[] = [];
  const pick = (select?: Record<string, boolean>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, user[k]])) : { ...user };
  return {
    user: {
      findUnique: async ({ where, select }: any) => (where.id === user.id || where.email === user.email ? pick(select) : null),
      findUniqueOrThrow: async ({ select }: any) => pick(select),
      update: async ({ data }: any) => Object.assign(user, data),
      updateMany: async ({ where, data }: any) => {
        const ok = where.OR.some((c: any) =>
          c.totpLastStep === null ? user.totpLastStep === null : user.totpLastStep < c.totpLastStep.lt,
        );
        if (ok) Object.assign(user, data);
        return { count: ok ? 1 : 0 };
      },
    },
    recoveryCode: {
      deleteMany: async () => {
        codes = [];
      },
      createMany: async ({ data }: any) => {
        codes.push(...data.map((d: any) => ({ ...d, usedAt: null })));
      },
      updateMany: async ({ where }: any) => {
        const c = codes.find((x) => x.codeHash === where.codeHash && !x.usedAt);
        if (c) c.usedAt = new Date();
        return { count: c ? 1 : 0 };
      },
      count: async () => codes.filter((c) => !c.usedAt).length,
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    refreshToken: { deleteMany: () => Promise.resolve(), create: () => Promise.resolve() },
    _user: user,
    _codes: () => codes,
  };
}

const config = { get: (k: string) => (k === 'ENCRYPTION_KEY' ? KEY : 30) };

async function enabledService() {
  const prisma = fakePrisma('motdepasse-solide');
  const service = new TwoFactorService(prisma as never, config as never);
  await service.setup('u1');
  const secret = decryptSecret(prisma._user.totpPendingSecret, KEY);
  // Code du pas précédent, pour laisser le code courant utilisable ensuite.
  const previous = authenticator.clone({ epoch: Date.now() - 30_000 }).generate(secret);
  const { recoveryCodes } = await service.enable('u1', previous);
  return { prisma, service, secret, recoveryCodes };
}

describe('chiffrement des secrets', () => {
  it('chiffre et déchiffre, avec un résultat différent à chaque fois', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP', KEY);
    expect(a).not.toBe(encryptSecret('JBSWY3DPEHPK3PXP', KEY));
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(a, KEY)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuse une donnée modifiée ou une mauvaise clé', () => {
    const a = encryptSecret('secret', KEY);
    expect(() => decryptSecret(a, 'autre-cle')).toThrow();
    expect(() => decryptSecret(a.slice(0, -2) + 'AA', KEY)).toThrow();
  });
});

describe('TwoFactorService', () => {
  it('prépare un QR code et garde le secret chiffré en attente', async () => {
    const prisma = fakePrisma('x');
    const service = new TwoFactorService(prisma as never, config as never);
    const setup = await service.setup('u1');
    expect(setup.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(setup.otpauthUrl).toContain('issuer=Licorne%20Tricount');
    expect(prisma._user.totpPendingSecret).toMatch(/^v1:/);
    expect(prisma._user.totpEnabledAt).toBeNull();
  });

  it('refuse l’activation avec un mauvais code', async () => {
    const prisma = fakePrisma('x');
    const service = new TwoFactorService(prisma as never, config as never);
    await service.setup('u1');
    await expect(service.enable('u1', '000000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('active avec un bon code et renvoie 10 codes de secours, stockés hachés', async () => {
    const { prisma, recoveryCodes } = await enabledService();
    expect(prisma._user.totpEnabledAt).toBeInstanceOf(Date);
    expect(prisma._user.totpPendingSecret).toBeNull();
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    recoveryCodes.forEach((c) => expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/));
    expect(prisma._codes().map((c) => c.codeHash)).toEqual(recoveryCodes.map(hashRecoveryCode));
  });

  it('accepte un code une seule fois', async () => {
    const { service, secret } = await enabledService();
    const code = authenticator.generate(secret);
    await expect(service.verify('u1', code)).resolves.toBe(true);
    await expect(service.verify('u1', code)).resolves.toBe(false);
  });

  it('refuse un code plus ancien que le dernier utilisé', async () => {
    const { service, secret } = await enabledService();
    await service.verify('u1', authenticator.generate(secret));
    const old = authenticator.clone({ epoch: Date.now() - 30_000 }).generate(secret);
    await expect(service.verify('u1', old)).resolves.toBe(false);
  });

  it('accepte un code de secours une seule fois, avec ou sans tiret et majuscules', async () => {
    const { service, recoveryCodes } = await enabledService();
    const code = recoveryCodes[3].toUpperCase().replace('-', '');
    await expect(service.verify('u1', code)).resolves.toBe(true);
    await expect(service.verify('u1', recoveryCodes[3])).resolves.toBe(false);
    await expect(service.remainingRecoveryCodes('u1')).resolves.toBe(9);
  });

  it('exige le mot de passe pour désactiver', async () => {
    const { service, prisma, secret } = await enabledService();
    await expect(
      service.disable('u1', 'mauvais', authenticator.generate(secret)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.disable('u1', 'motdepasse-solide', authenticator.generate(secret));
    expect(prisma._user.totpEnabledAt).toBeNull();
    expect(prisma._user.totpSecret).toBeNull();
  });

  it('génère des codes de secours lisibles, sans caractères ambigus', () => {
    for (let i = 0; i < 50; i += 1) expect(generateRecoveryCode()).not.toMatch(/[01ilo]/);
  });
});

describe('connexion avec double authentification', () => {
  const jwt = new JwtService({ secret: 'jwt-de-test', signOptions: { expiresIn: '15m' } });

  async function setup() {
    const ctx = await enabledService();
    const auth = new AuthService(ctx.prisma as never, jwt, config as never, ctx.service);
    return { ...ctx, auth };
  }

  it('ne crée pas de session sans le code', async () => {
    const { auth } = await setup();
    const result = await auth.login({ email: 'timo@mail.com', password: 'motdepasse-solide' });
    expect(result).toEqual({ twoFactorRequired: true, challengeToken: expect.any(String) });
    expect('accessToken' in result).toBe(false);
  });

  it('ouvre la session avec le bon code', async () => {
    const { auth, secret } = await setup();
    const { challengeToken } = (await auth.login({
      email: 'timo@mail.com',
      password: 'motdepasse-solide',
    })) as { challengeToken: string };
    const session = await auth.completeTwoFactor(challengeToken, authenticator.generate(secret));
    expect(session.accessToken).toBeTruthy();
    expect(session.user.twoFactorEnabled).toBe(true);
    expect(session.user).not.toHaveProperty('totpSecret');
  });

  it('refuse un mauvais code et un jeton d’accès utilisé comme jeton d’étape', async () => {
    const { auth } = await setup();
    const { challengeToken } = (await auth.login({
      email: 'timo@mail.com',
      password: 'motdepasse-solide',
    })) as { challengeToken: string };
    await expect(auth.completeTwoFactor(challengeToken, '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const accessToken = jwt.sign({ sub: 'u1' });
    await expect(auth.completeTwoFactor(accessToken, '123456')).rejects.toThrow(/expirée/);
  });

  it('le jeton d’étape ne donne jamais accès à l’API', async () => {
    const strategy = new JwtStrategy({} as never, { get: () => 'jwt-de-test' } as never);
    await expect(strategy.validate({ sub: 'u1', purpose: '2fa' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
