import {
  aggregateBalances,
  buildPartyIndex,
  equalizeFamilies,
  expandPartyShares,
  membersByParty,
  partyShares,
  splitByParties,
} from './parties.util';
import { simplifyDebts } from '../balances/balance.util';

// Les Martin (Alice, Ben) forment une famille ; Chloé et David sont seuls.
const links = [
  { userId: 'alice', familyId: 'martin' },
  { userId: 'ben', familyId: 'martin' },
  { userId: 'chloe', familyId: null },
  { userId: 'david', familyId: null },
];
const index = buildPartyIndex(links);
const sum = (xs: { amountCents: number }[]) => xs.reduce((s, x) => s + x.amountCents, 0);

describe('entités (familles)', () => {
  it('associe chaque personne à son entité', () => {
    expect(index.get('alice')).toBe('f:martin');
    expect(index.get('ben')).toBe('f:martin');
    expect(index.get('chloe')).toBe('u:chloe');
    expect(membersByParty(links).get('f:martin')).toEqual(['alice', 'ben']);
  });

  it('le coefficient d’une famille est la somme de ses membres', () => {
    const shares = partyShares(
      [
        { userId: 'alice', shareBp: 2500 },
        { userId: 'ben', shareBp: 2500 },
        { userId: 'chloe', shareBp: 3000 },
        { userId: 'david', shareBp: 2000 },
      ],
      index,
    );
    expect(shares.get('f:martin')).toBe(5000);
    expect(shares.get('u:chloe')).toBe(3000);
  });

  it('répartit le coefficient d’une famille à parts égales, au point de base près', () => {
    const expanded = expandPartyShares(
      [
        { partyId: 'f:martin', shareBp: 3333 },
        { partyId: 'u:chloe', shareBp: 3334 },
        { partyId: 'u:david', shareBp: 3333 },
      ],
      membersByParty(links),
    );
    const alice = expanded.find((e) => e.userId === 'alice')!.shareBp;
    const ben = expanded.find((e) => e.userId === 'ben')!.shareBp;
    expect(alice + ben).toBe(3333);
    expect(Math.abs(alice - ben)).toBeLessThanOrEqual(1);
    expect(expanded.reduce((s, e) => s + e.shareBp, 0)).toBe(10_000);
  });

  it('rééquilibre une famille sans changer son total', () => {
    const result = equalizeFamilies(
      [
        { userId: 'alice', shareBp: 4000 },
        { userId: 'ben', shareBp: 1000 },
        { userId: 'chloe', shareBp: 3000 },
        { userId: 'david', shareBp: 2000 },
      ],
      links,
    );
    expect(result).toEqual([
      { userId: 'alice', shareBp: 2500 },
      { userId: 'ben', shareBp: 2500 },
      { userId: 'chloe', shareBp: 3000 },
      { userId: 'david', shareBp: 2000 },
    ]);
  });

  it('répartit une dépense entre entités puis à parts égales dans la famille', () => {
    // Famille 50 %, Chloé 30 %, David 20 % ; 100,01 € à répartir.
    const shares = splitByParties(
      10_001,
      [
        { userId: 'alice', weight: 2500 },
        { userId: 'ben', weight: 2500 },
        { userId: 'chloe', weight: 3000 },
        { userId: 'david', weight: 2000 },
      ],
      index,
    );
    const of = (id: string) => shares.find((s) => s.userId === id)!.amountCents;
    expect(of('alice') + of('ben')).toBe(5001);
    expect(Math.abs(of('alice') - of('ben'))).toBeLessThanOrEqual(1);
    expect(of('chloe')).toBe(3000);
    expect(of('david')).toBe(2000);
    expect(sum(shares)).toBe(10_001);
  });

  it('additionne les soldes par famille et simplifie les dettes entre entités', () => {
    const parties = aggregateBalances(
      [
        { userId: 'alice', paidCents: 9000, owedCents: 2500, balanceCents: 6500 },
        { userId: 'ben', paidCents: 0, owedCents: 2500, balanceCents: -2500 },
        { userId: 'chloe', paidCents: 1000, owedCents: 3000, balanceCents: -2000 },
        { userId: 'david', paidCents: 0, owedCents: 2000, balanceCents: -2000 },
      ],
      index,
    );
    const martin = parties.find((p) => p.partyId === 'f:martin')!;
    expect(martin.balanceCents).toBe(4000);
    expect(martin.userIds).toEqual(['alice', 'ben']);
    expect(parties.reduce((s, p) => s + p.balanceCents, 0)).toBe(0);

    const transfers = simplifyDebts(
      parties.map((p) => ({ ...p, userId: p.partyId })),
    );
    // Ben ne rembourse pas Alice : ils sont dans la même entité.
    expect(transfers).toEqual([
      { fromUserId: 'u:chloe', toUserId: 'f:martin', amountCents: 2000 },
      { fromUserId: 'u:david', toUserId: 'f:martin', amountCents: 2000 },
    ]);
  });

  it('un ancien membre forme sa propre entité', () => {
    const parties = aggregateBalances(
      [{ userId: 'parti', paidCents: 0, owedCents: 100, balanceCents: -100 }],
      index,
    );
    expect(parties[0].partyId).toBe('u:parti');
  });
});
