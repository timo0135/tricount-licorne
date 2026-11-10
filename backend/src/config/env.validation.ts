/**
 * Validation des variables d'environnement au démarrage.
 * L'API refuse de démarrer avec une configuration dangereuse.
 */
const WEAK_SECRETS = ['change-moi', 'changeme', 'secret', 'licorne'];

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_DAYS: number;
  PORT: number;
  CORS_ORIGIN: string;
  COOKIE_SECURE: boolean;
  TRUST_PROXY: number;
  UPLOADS_DIR: string;
  ENCRYPTION_KEY: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGINS: string[];
}

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (key: string, fallback?: string) => {
    const value = raw[key];
    return value === undefined || value === '' ? fallback : String(value);
  };
  const int = (key: string, fallback: number) => {
    const value = str(key);
    if (value === undefined) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) errors.push(`${key} doit être un nombre entier`);
    return parsed;
  };

  const nodeEnv = (str('NODE_ENV', 'development') as AppEnv['NODE_ENV']) ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push('NODE_ENV doit valoir development, production ou test');
  }
  const isProd = nodeEnv === 'production';

  const databaseUrl = str('DATABASE_URL');
  if (!databaseUrl) errors.push('DATABASE_URL est obligatoire');

  const secret = str('JWT_SECRET') ?? '';
  if (!secret) {
    errors.push('JWT_SECRET est obligatoire');
  } else if (isProd) {
    const weak = WEAK_SECRETS.some((w) => secret.toLowerCase().includes(w));
    if (secret.length < 32 || weak) {
      errors.push(
        'JWT_SECRET doit faire au moins 32 caractères aléatoires en production (ex. : openssl rand -base64 48)',
      );
    }
  }

  // Clé de chiffrement des secrets de double authentification (distincte du secret JWT,
  // qu'on peut ainsi changer sans casser la 2FA des utilisateurs).
  const encryptionKey = str('ENCRYPTION_KEY') ?? (isProd ? '' : 'dev-uniquement-cle-de-chiffrement');
  if (!encryptionKey) {
    errors.push('ENCRYPTION_KEY est obligatoire en production (ex. : openssl rand -base64 48)');
  } else if (isProd) {
    const weak = WEAK_SECRETS.some((w) => encryptionKey.toLowerCase().includes(w));
    if (encryptionKey.length < 32 || weak || encryptionKey === secret) {
      errors.push('ENCRYPTION_KEY doit faire au moins 32 caractères aléatoires, différents de JWT_SECRET');
    }
  }

  const env: AppEnv = {
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl ?? '',
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', '15m')!,
    REFRESH_TOKEN_DAYS: int('REFRESH_TOKEN_DAYS', 30),
    PORT: int('PORT', 3000),
    CORS_ORIGIN: str('CORS_ORIGIN', 'http://localhost:5173')!,
    COOKIE_SECURE: (str('COOKIE_SECURE') ?? String(isProd)) === 'true',
    TRUST_PROXY: int('TRUST_PROXY', 1),
    UPLOADS_DIR: str('UPLOADS_DIR', `${process.cwd()}/uploads`)!,
    ENCRYPTION_KEY: encryptionKey,
    // Passkeys : liées au nom de domaine exact (ex. tricount.timotheebenchergui.fr).
    WEBAUTHN_RP_ID: str('WEBAUTHN_RP_ID', 'localhost')!,
    WEBAUTHN_ORIGINS: str('WEBAUTHN_ORIGINS', 'http://localhost:8080,http://localhost:5173')!
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };

  if (isProd && env.WEBAUTHN_RP_ID === 'localhost') {
    errors.push('WEBAUTHN_RP_ID doit être le nom de domaine du site en production');
  }
  if (isProd && env.WEBAUTHN_ORIGINS.some((o) => !o.startsWith('https://'))) {
    errors.push('WEBAUTHN_ORIGINS doit contenir des adresses https:// en production');
  }
  if (errors.length) {
    throw new Error(`Configuration invalide :\n  - ${errors.join('\n  - ')}`);
  }

  if (env.REFRESH_TOKEN_DAYS < 1 || env.REFRESH_TOKEN_DAYS > 365) {
    errors.push('REFRESH_TOKEN_DAYS doit être compris entre 1 et 365');
  }

  if (errors.length) {
    throw new Error(`Configuration invalide :\n  - ${errors.join('\n  - ')}`);
  }
  return env;
}
