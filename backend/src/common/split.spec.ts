import { splitByWeights, validateExactShares } from './split';

describe('splitByWeights', () => {
  it('répartit un montant divisible à parts égales', () => {
    const shares = splitByWeights(3000, [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    expect(shares.map((s) => s.amountCents)).toEqual([1000, 1000, 1000]);
  });

  it('ne perd aucun centime quand ça ne tombe pas juste', () => {
    const shares = splitByWeights(1000, [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(1000);
    expect(shares.map((s) => s.amountCents).sort()).toEqual([333, 333, 334]);
  });

  it('respecte les parts pondérées', () => {
    const shares = splitByWeights(6000, [
      { userId: 'a', weight: 2 },
      { userId: 'b', weight: 1 },
    ]);
    expect(shares).toEqual([
      { userId: 'a', weight: 2, amountCents: 4000 },
      { userId: 'b', weight: 1, amountCents: 2000 },
    ]);
  });

  it('reste exact sur un grand nombre de participants', () => {
    const participants = Array.from({ length: 7 }, (_, i) => ({ userId: `u${i}` }));
    const shares = splitByWeights(10001, participants);
    expect(shares.reduce((s, x) => s + x.amountCents, 0)).toBe(10001);
  });

  it('refuse une part nulle ou négative', () => {
    expect(() => splitByWeights(1000, [{ userId: 'a', weight: 0 }])).toThrow();
  });
});

describe('validateExactShares', () => {
  it('accepte une répartition qui tombe juste', () => {
    const shares = validateExactShares(2500, [
      { userId: 'a', amountCents: 1000 },
      { userId: 'b', amountCents: 1500 },
    ]);
    expect(shares).toHaveLength(2);
  });

  it('refuse une répartition incohérente', () => {
    expect(() =>
      validateExactShares(2500, [
        { userId: 'a', amountCents: 1000 },
        { userId: 'b', amountCents: 1000 },
      ]),
    ).toThrow();
  });
});
