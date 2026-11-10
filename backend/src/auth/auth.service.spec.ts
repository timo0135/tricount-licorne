import { UnauthorizedException } from '@nestjs/common';
import { AuthService, hashToken } from './auth.service';

const user = { id: 'u1', email: 'a@b.fr', name: 'Alice', emoji: '🦄', color: '#fff', createdAt: new Date() };

function setup(stored: unknown) {
  const prisma = {
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockReturnValue('delete'),
      create: jest.fn().mockReturnValue('create'),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const jwt = { sign: jest.fn().mockReturnValue('access-token') };
  const config = { get: jest.fn().mockReturnValue(30) };
  const service = new AuthService(prisma as never, jwt as never, config as never, {} as never);
  return { service, prisma };
}

const token = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  userId: 'u1',
  user,
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  ...overrides,
});

describe('AuthService.refresh', () => {
  it('refuse une requête sans jeton', async () => {
    const { service } = setup(null);
    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cherche le jeton par son empreinte, jamais en clair', async () => {
    const { service, prisma } = setup(token());
    await service.refresh('brut');
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('brut') } }),
    );
  });

  it('révoque l’ancien jeton et émet une nouvelle session', async () => {
    const { service, prisma } = setup(token());
    const session = await service.refresh('brut');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(session.accessToken).toBe('access-token');
    expect(session.refreshToken).not.toBe('brut');
    expect(session.refreshToken.length).toBeGreaterThan(40);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('refuse un jeton expiré', async () => {
    const { service } = setup(token({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh('brut')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('coupe toutes les sessions si un jeton déjà échangé est réutilisé', async () => {
    const { service, prisma } = setup(token({ revokedAt: new Date(Date.now() - 120_000) }));
    await expect(service.refresh('brut')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('tolère deux requêtes simultanées (délai de grâce)', async () => {
    const { service, prisma } = setup(token({ revokedAt: new Date(Date.now() - 5_000) }));
    const session = await service.refresh('brut');
    expect(session.accessToken).toBe('access-token');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
