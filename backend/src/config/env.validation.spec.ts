import { validateEnv } from './env.validation';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'dev-secret' };

describe('validateEnv', () => {
  it('applique les valeurs par défaut en développement', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.JWT_EXPIRES_IN).toBe('15m');
    expect(env.REFRESH_TOKEN_DAYS).toBe(30);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('exige DATABASE_URL et JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });

  it('refuse un secret faible en production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/32 caractères/);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'change-moi-'.repeat(4) }),
    ).toThrow(/32 caractères/);
  });

  it('accepte un secret solide en production et active les cookies sécurisés', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'x7Gq9'.repeat(8) });
    expect(env.COOKIE_SECURE).toBe(true);
  });
});
