import { computeBalances, simplifyDebts } from './balance.util';

const input = (userId: string, paid: number, owed: number, sent = 0, received = 0) => ({
  userId,
  paidCents: paid,
  owedCents: owed,
  sentCents: sent,
  receivedCents: received,
});

describe('computeBalances', () => {
  it('calcule payé - dû', () => {
    const [a] = computeBalances([input('a', 3000, 1000)]);
    expect(a.balanceCents).toBe(2000);
  });

  it('prend en compte les remboursements déjà effectués', () => {
    const [a, b] = computeBalances([input('a', 3000, 1500, 0, 1500), input('b', 0, 1500, 1500, 0)]);
    expect(a.balanceCents).toBe(0);
    expect(b.balanceCents).toBe(0);
  });

  it('somme des soldes toujours nulle', () => {
    const balances = computeBalances([
      input('a', 5000, 2000),
      input('b', 1000, 2000),
      input('c', 0, 2000),
    ]);
    expect(balances.reduce((s, x) => s + x.balanceCents, 0)).toBe(0);
  });
});

describe('simplifyDebts', () => {
  const bal = (userId: string, balanceCents: number) => ({
    userId,
    paidCents: 0,
    owedCents: 0,
    balanceCents,
  });

  it('ne propose rien quand tout est équilibré', () => {
    expect(simplifyDebts([bal('a', 0), bal('b', 0)])).toEqual([]);
  });

  it('règle un cas simple en un transfert', () => {
    expect(simplifyDebts([bal('a', 1000), bal('b', -1000)])).toEqual([
      { fromUserId: 'b', toUserId: 'a', amountCents: 1000 },
    ]);
  });

  it('produit au plus n-1 transferts et solde tout le monde', () => {
    const balances = [bal('a', 4500), bal('b', -1500), bal('c', -2000), bal('d', -1000)];
    const transfers = simplifyDebts(balances);

    expect(transfers.length).toBeLessThanOrEqual(balances.length - 1);

    const net = new Map(balances.map((b) => [b.userId, b.balanceCents]));
    for (const t of transfers) {
      net.set(t.fromUserId, net.get(t.fromUserId) + t.amountCents);
      net.set(t.toUserId, net.get(t.toUserId) - t.amountCents);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);
  });

  it('gère plusieurs créanciers et débiteurs', () => {
    const balances = [bal('a', 3000), bal('b', 2000), bal('c', -4000), bal('d', -1000)];
    const transfers = simplifyDebts(balances);
    const net = new Map(balances.map((b) => [b.userId, b.balanceCents]));
    for (const t of transfers) {
      net.set(t.fromUserId, net.get(t.fromUserId) + t.amountCents);
      net.set(t.toUserId, net.get(t.toUserId) - t.amountCents);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);
    expect(transfers.every((t) => t.amountCents > 0)).toBe(true);
  });
});
